// One-off: applies sendpulseCourseId mapping to PROD courses.
// Loads .env (prod) explicitly.
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env'), override: true });

const prisma = new PrismaClient();

const mapping = [
  { slug: 'military-psychology', sendpulseCourseId: 47357 },
  { slug: 'emotional-intelligence', sendpulseCourseId: 48186 },
  { slug: 'mentorship', sendpulseCourseId: 33305 },
  { slug: 'psychology-basics', sendpulseCourseId: 32460 },
  { slug: 'psychiatry-basics', sendpulseCourseId: 32520 },
  { slug: 'psychotherapy-of-biblical-heroes', sendpulseCourseId: 36073 },
  { slug: 'sex-education', sendpulseCourseId: 42768 },
];

let updated = 0;
let skipped = 0;
const errors = [];

for (const m of mapping) {
  try {
    const before = await prisma.course.findUnique({
      where: { slug: m.slug },
      select: { sendpulseCourseId: true, title: true },
    });
    if (!before) {
      errors.push(`MISSING: ${m.slug}`);
      continue;
    }
    if (before.sendpulseCourseId === m.sendpulseCourseId) {
      console.log(`= ${m.slug}: already ${m.sendpulseCourseId}`);
      skipped += 1;
      continue;
    }
    await prisma.course.update({
      where: { slug: m.slug },
      data: { sendpulseCourseId: m.sendpulseCourseId },
    });
    console.log(`+ ${m.slug}: ${before.sendpulseCourseId ?? 'NULL'} → ${m.sendpulseCourseId}  (${before.title})`);
    updated += 1;
  } catch (err) {
    errors.push(`${m.slug}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log(`\nDone. updated=${updated} skipped=${skipped} errors=${errors.length}`);
if (errors.length > 0) {
  for (const e of errors) console.log(`  ! ${e}`);
}

await prisma.$disconnect();
