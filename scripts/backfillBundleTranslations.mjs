// One-shot backfill: translate every existing Bundle row that is missing
// titleEn / titlePl. Run with: node scripts/backfillBundleTranslations.mjs
import prisma from './_db.mjs';

const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';

async function translateBatch(texts, targetLang) {
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
    }),
  });
  if (!r.ok) throw new Error(`DeepL ${r.status}`);
  const d = await r.json();
  return d.translations.map((t) => t.text);
}

async function translateString(text, lang) {
  if (!text) return null;
  const [out] = await translateBatch([text], lang);
  return out;
}

async function main() {
  const bundles = await prisma.bundle.findMany({
    where: { OR: [{ titleEn: null }, { titlePl: null }] },
  });
  console.log(`Found ${bundles.length} bundle(s) needing translation.`);

  for (const b of bundles) {
    console.log(`→ ${b.slug}: ${b.title}`);
    try {
      const titleEn = b.titleEn ?? await translateString(b.title, 'en');
      const titlePl = b.titlePl ?? await translateString(b.title, 'pl');
      await prisma.bundle.update({
        where: { id: b.id },
        data: { titleEn, titlePl },
      });
      console.log(`  ✓ EN: ${titleEn}`);
      console.log(`  ✓ PL: ${titlePl}`);
    } catch (e) {
      console.error(`  ✗ failed:`, e.message);
    }
  }

  await prisma.$disconnect();
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
