// One-shot backfill: translate every existing news row that is missing EN/PL
// fields (title/excerpt/content/previewContent + templateBlocks/templateData).
//
// Targets the DEV Neon branch by default (як усі scripts/ через .env.local override).
//   node scripts/backfillNewsTranslations.mjs
// Для ПРОДА (свідома мутація) — прапор --prod: НЕ вантажимо .env.local, тож
// лишається .env, який @prisma/client auto-load-ить = прод-URL:
//   node scripts/backfillNewsTranslations.mjs --prod
// Скрипт ЗАВЖДИ друкує хост цільової БД перед роботою — щоб не сплутати dev/pre/prod.
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const USE_PROD = process.argv.includes('--prod');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// dev default: .env.local override (як scripts/_db.mjs). --prod: пропускаємо
// .env.local → @prisma/client auto-loaded .env (прод) лишається чинним.
if (!USE_PROD) config({ path: resolve(root, '.env.local'), override: true });
const prisma = new PrismaClient();

const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';

async function translateBatch(texts, targetLang, html = false) {
  if (!texts.length) return texts;
  const r = await fetch(DEEPL_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: texts,
      source_lang: 'UK',
      target_lang: targetLang === 'pl' ? 'PL' : 'EN-US',
      ...(html ? { tag_handling: 'html' } : {}),
    }),
  });
  if (!r.ok) throw new Error(`DeepL ${r.status}`);
  const d = await r.json();
  return d.translations.map((t) => t.text);
}

async function translateString(text, lang) {
  if (!text) return null;
  const [out] = await translateBatch([text], lang, false);
  return out;
}

// Дзеркало lib/translate.ts SKIP_KEYS: структурні/enum/id/url-поля НЕ перекладаємо
// (інакше DeepL псує PL-вирівнювання, enum-и, JSON-рядки, ламає URL/color/href).
const SKIP_KEYS = [
  'color', 'image', 'href', 'icon', 'number', 'rating', 'step', 'value', 'currency',
  'url', 'src', 'embedUrl', 'videoUrl', 'imageUrl',
  'align', 'vAlign', 'displayMode', 'objectFit', 'fontFamily', 'frameStyle', 'frameEffect',
  'borderRadiusCorners', 'imgRadiusCorners', 'aspectRatio', 'level', 'templateKind',
  'newsId', 'overlays', 'templateBlocks', 'templateData', 'templateCanvas',
];
function shouldSkip(_k, v) {
  if (typeof v !== 'string') return true;
  if (/^(https?:\/\/|\/|from-\[|#[0-9A-Fa-f]|\.webp|\.jpg|\.png|\.jpeg)/.test(v)) return true;
  if (/^\d+[+]?$/.test(v)) return true;
  if (!v.trim()) return true;
  return false;
}

function collectStrings(obj, key, strings, paths, currentPath) {
  if (typeof obj === 'string') {
    if (!SKIP_KEYS.includes(key) && !shouldSkip(key, obj)) {
      strings.push(obj);
      paths.push(currentPath);
    }
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => collectStrings(item, key, strings, paths, `${currentPath}[${i}]`));
    return;
  }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (!SKIP_KEYS.includes(k)) collectStrings(v, k, strings, paths, `${currentPath}.${k}`);
    }
  }
}

function applyTranslations(obj, key, map, currentPath) {
  if (typeof obj === 'string') {
    if (!SKIP_KEYS.includes(key) && !shouldSkip(key, obj)) return map.get(currentPath) ?? obj;
    return obj;
  }
  if (Array.isArray(obj)) return obj.map((it, i) => applyTranslations(it, key, map, `${currentPath}[${i}]`));
  if (obj && typeof obj === 'object') {
    const r = {};
    for (const [k, v] of Object.entries(obj)) {
      r[k] = SKIP_KEYS.includes(k) ? v : applyTranslations(v, k, map, `${currentPath}.${k}`);
    }
    return r;
  }
  return obj;
}

async function translateNewsContent(content, lang) {
  if (!content) return content;
  let blocks;
  try { blocks = JSON.parse(content); } catch { return content; }
  if (!Array.isArray(blocks)) return content;

  const strings = [];
  const paths = [];
  collectStrings(blocks, '', strings, paths, 'root');
  if (!strings.length) return content;

  const out = [];
  const BATCH = 50;
  for (let i = 0; i < strings.length; i += BATCH) {
    const t = await translateBatch(strings.slice(i, i + BATCH), lang, true);
    out.push(...t);
  }
  const map = new Map();
  paths.forEach((p, i) => map.set(p, out[i]));
  return JSON.stringify(applyTranslations(blocks, '', map, 'root'));
}

// Як translateNewsContent, але приймає array (templateBlocks) АБО object
// (legacy templateData EventData/ArticleData).
async function translateNewsJson(json, lang) {
  if (!json) return json;
  let parsed;
  try { parsed = JSON.parse(json); } catch { return json; }
  if (parsed === null || typeof parsed !== 'object') return json;
  const strings = [];
  const paths = [];
  collectStrings(parsed, '', strings, paths, 'root');
  if (!strings.length) return json;
  const out = [];
  const BATCH = 50;
  for (let i = 0; i < strings.length; i += BATCH) {
    const t = await translateBatch(strings.slice(i, i + BATCH), lang, true);
    out.push(...t);
  }
  const map = new Map();
  paths.forEach((p, i) => map.set(p, out[i]));
  return JSON.stringify(applyTranslations(parsed, '', map, 'root'));
}

async function main() {
  const dbHost = (process.env.DATABASE_URL || '').match(/@([^/:?]+)/)?.[1] || 'unknown';
  console.log(`[backfill] target DB host: ${dbHost} ${USE_PROD ? '(--prod)' : '(dev default)'}`);

  const news = await prisma.news.findMany({
    where: {
      OR: [
        { titleEn: null }, { titlePl: null },
        { contentEn: null }, { contentPl: null },
        // previewContent: перекладаємо тільки якщо оригінал заданий і EN/PL ще нема.
        { AND: [{ NOT: { previewContent: null } }, { previewContentEn: null }] },
        { AND: [{ NOT: { previewContent: null } }, { previewContentPl: null }] },
        // Шаблонний контент (лише публічні новини, не blueprints).
        { AND: [{ isTemplate: false }, { NOT: { templateBlocks: null } }, { templateBlocksEn: null }] },
        { AND: [{ isTemplate: false }, { NOT: { templateBlocks: null } }, { templateBlocksPl: null }] },
        { AND: [{ isTemplate: false }, { NOT: { templateData: null } }, { templateDataEn: null }] },
        { AND: [{ isTemplate: false }, { NOT: { templateData: null } }, { templateDataPl: null }] },
      ],
    },
  });
  console.log(`Found ${news.length} news items needing translation.`);

  for (const n of news) {
    console.log(`→ ${n.slug}`);
    try {
      const titleEn = n.titleEn ?? await translateString(n.title, 'en');
      const titlePl = n.titlePl ?? await translateString(n.title, 'pl');
      const excerptEn = n.excerptEn ?? (n.excerpt ? await translateString(n.excerpt, 'en') : null);
      const excerptPl = n.excerptPl ?? (n.excerpt ? await translateString(n.excerpt, 'pl') : null);
      const contentEn = n.contentEn ?? await translateNewsContent(n.content, 'en');
      const contentPl = n.contentPl ?? await translateNewsContent(n.content, 'pl');
      const previewContentEn = n.previewContent && !n.previewContentEn
        ? await translateNewsContent(n.previewContent, 'en')
        : (n.previewContentEn ?? null);
      const previewContentPl = n.previewContent && !n.previewContentPl
        ? await translateNewsContent(n.previewContent, 'pl')
        : (n.previewContentPl ?? null);

      // Шаблонний контент — тільки для публічних новин (не blueprints).
      const doTpl = !n.isTemplate;
      const templateBlocksEn = doTpl && n.templateBlocks && !n.templateBlocksEn
        ? await translateNewsJson(n.templateBlocks, 'en') : (n.templateBlocksEn ?? null);
      const templateBlocksPl = doTpl && n.templateBlocks && !n.templateBlocksPl
        ? await translateNewsJson(n.templateBlocks, 'pl') : (n.templateBlocksPl ?? null);
      const templateDataEn = doTpl && n.templateData && !n.templateDataEn
        ? await translateNewsJson(n.templateData, 'en') : (n.templateDataEn ?? null);
      const templateDataPl = doTpl && n.templateData && !n.templateDataPl
        ? await translateNewsJson(n.templateData, 'pl') : (n.templateDataPl ?? null);

      await prisma.news.update({
        where: { id: n.id },
        data: {
          titleEn, titlePl, excerptEn, excerptPl,
          contentEn, contentPl,
          previewContentEn, previewContentPl,
          templateBlocksEn, templateBlocksPl,
          templateDataEn, templateDataPl,
        },
      });
      console.log(`  ✓ updated`);
    } catch (e) {
      console.error(`  ✗ failed:`, e.message);
    }
  }

  await prisma.$disconnect();
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
