import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env'), override: true });

const prisma = new PrismaClient();

const bundles = await prisma.bundle.findMany({
  include: { courses: true },
  orderBy: { createdAt: 'asc' },
  take: 10,
});

for (const b of bundles) {
  const paid = b.courses.filter((c) => !c.isFree).map((c) => c.courseSlug);
  const free = b.courses.filter((c) => c.isFree).map((c) => c.courseSlug);
  console.log(`${b.id} | ${b.type} | slug=${b.slug} | price=${b.price} | paid=[${paid.join(',')}] | free=[${free.join(',')}]`);
}

await prisma.$disconnect();
