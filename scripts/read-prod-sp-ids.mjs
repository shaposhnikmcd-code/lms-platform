// One-off: prints current sendpulseCourseId state from PROD branch.
// Loads .env (prod) explicitly, ignoring .env.local.
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env'), override: true });

const prisma = new PrismaClient();

const slugs = [
  'military-psychology',
  'emotional-intelligence',
  'mentorship',
  'psychology-basics',
  'psychiatry-basics',
  'psychotherapy-of-biblical-heroes',
  'sex-education',
];

const courses = await prisma.course.findMany({
  where: { slug: { in: slugs } },
  select: { id: true, slug: true, title: true, sendpulseCourseId: true, published: true, price: true },
  orderBy: { title: 'asc' },
});

console.log(`PROD: found ${courses.length} of ${slugs.length} expected courses\n`);
for (const c of courses) {
  const has = c.sendpulseCourseId !== null ? `SP=${c.sendpulseCourseId}` : 'SP=NULL';
  console.log(`- ${has}  ${c.title}  (slug=${c.slug}, published=${c.published}, price=${c.price})`);
}

const foundSlugs = new Set(courses.map((c) => c.slug));
const missing = slugs.filter((s) => !foundSlugs.has(s));
if (missing.length > 0) {
  console.log(`\nMISSING on prod: ${missing.join(', ')}`);
}

await prisma.$disconnect();
