// Idempotent seed для 2 BLUEPRINT-шаблонів новин.
//
// Blueprint = News-запис з isTemplate=true + templateKind=ARTICLE/EVENT +
// templateData=defaults. Менеджер з адмінки натискає «Створити з шаблону» —
// клонується у нову News (isTemplate=false, templateKind, templateData=clone),
// яка живе як звичайна новина (можна публікувати, редагувати, видаляти).
//
// Blueprints приховані від публічного /news (фільтр isTemplate=false на
// рендері). Дефолти дублюються тут (ALSO в lib/news/templates/types.ts) —
// одна копія служить runtime-парсингу, інша — seed-у.
//
// Запуск:
//   node scripts/seed-news-templates.mjs           — на dev branch (за замовч.)
//   node scripts/seed-news-templates.mjs --prod    — на прод Neon (через .env)

import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const isProd = process.argv.includes('--prod');
// Завантажуємо ВІДПОВІДНИЙ env-файл. Для prod беремо .env (там прод-URL); для
// dev — .env.local (де dev-branch). Override:true потрібен щоб перебити
// прод-URL, який @prisma/client auto-load-ить на import.
config({ path: resolve(root, isProd ? '.env' : '.env.local'), override: true });
const prisma = new PrismaClient();
console.log(`▸ Target: ${isProd ? 'PROD (.env)' : 'DEV (.env.local)'}`);

const ARTICLE_DEFAULTS = {
  cover: { url: '', alt: '', caption: '' },
  category: 'СТАТТЯ · 5 ХВ ЧИТАННЯ',
  title: '[Заголовок статті]',
  lead: 'Короткий лід — 1-2 речення, що задають контекст і інтригу. Розкривають тему до того, як читач піде у деталі.',
  sections: [
    {
      heading: '[Розділ 1 — назва]',
      body:
        'Перший абзац розділу. Розкривайте основну думку: що, чому, для кого. Тримайте речення короткими — 12-18 слів — щоб текст легко читався з екрану.\n\n' +
        'Другий абзац — деталі та приклади. Конкретика робить матеріал переконливим: цифри, кейси, цитати дослідників.',
    },
    {
      heading: '[Розділ 2 — назва]',
      body: 'Зміст другого розділу. Розгорніть тезу — поясніть, аргументуйте, наведіть приклади. Якщо є практичний інструмент — опишіть його крок за кроком.',
      image: {
        url: '',
        alt: '',
        caption: '',
      },
    },
  ],
  pullquote: '[Ключова думка статті — цитата, що ловить увагу і резюмує головне]',
  conclusion: 'Підсумуйте 2-3 ключові тези статті. Підкажіть читачеві, що робити далі — куди звертатись, що читати, який крок зробити.',
  authorLine: '[Автор · контакт · джерела]',
};

const EVENT_DEFAULTS = {
  photo: { url: '', alt: '', caption: '' },
  title: '[Назва події]',
  price: '[X грн]',
  duration: '[N хв]',
  ctaLabel: 'Записатися на консультацію',
  ctaHref: '',
  specialistName: '[Імʼя Прізвище]',
  specialistRole: '[Посада / спеціалізація]',
  specialistTagline: '[Tagline — досвід або фокус, 1 рядок]',
  about:
    'Опишіть фахівця — підхід, з ким працює, у чому експертний. 2-3 речення, без зайвої теорії — конкретика про користь для клієнта.\n\n' +
    'Можна додати другий абзац: про що клієнти найчастіше звертаються, який формат сесій, очікувані результати.',
  education: [
    { title: '[Назва освіти]', meta: '[Тип / диплом · роки]' },
    { title: '[Друга освіта]', meta: '[Програма · рік завершення]' },
    { title: '[Курс підвищення]', meta: '[Школа · рік]' },
  ],
};

const BLUEPRINTS = [
  {
    slug: '__template_article',
    title: '[Шаблон] Стаття / Огляд',
    excerpt: ARTICLE_DEFAULTS.lead,
    category: 'ARTICLE',
    templateKind: 'ARTICLE',
    templateData: ARTICLE_DEFAULTS,
  },
  {
    slug: '__template_event',
    title: '[Шаблон] Подія / Фахівець',
    excerpt: EVENT_DEFAULTS.about.split('\n\n')[0],
    category: 'EVENT',
    templateKind: 'EVENT',
    templateData: EVENT_DEFAULTS,
  },
];

let upserted = 0;
for (const b of BLUEPRINTS) {
  const existing = await prisma.news.findUnique({ where: { slug: b.slug } });
  const data = {
    title: b.title,
    excerpt: b.excerpt,
    category: b.category,
    isTemplate: true,
    templateKind: b.templateKind,
    templateData: JSON.stringify(b.templateData),
    published: false,
    // Блок-канвасні поля у blueprint-ах не використовуються — render-имо
    // через шаблонний компонент. Чистимо щоб не плутали.
    content: '',
    previewContent: null,
    pageBgColor: null,
    imageUrl: (b.templateData.cover?.url || b.templateData.photo?.url) || null,
  };
  if (existing) {
    await prisma.news.update({ where: { id: existing.id }, data });
    console.log(`= updated blueprint: ${b.slug} (id=${existing.id})`);
  } else {
    const created = await prisma.news.create({ data: { slug: b.slug, ...data } });
    console.log(`+ created blueprint: ${b.slug} (id=${created.id})`);
  }
  upserted += 1;
}

console.log(`\nDone. blueprints=${upserted}`);
await prisma.$disconnect();
