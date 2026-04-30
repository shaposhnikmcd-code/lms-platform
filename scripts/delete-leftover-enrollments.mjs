import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env'), override: true });

const prisma = new PrismaClient();

const user = await prisma.user.findUnique({
  where: { email: 'andersen.pm2020@gmail.com' },
  select: { id: true },
});

const del = await prisma.enrollment.deleteMany({ where: { userId: user.id } });
console.log(`Enrollments deleted: ${del.count}`);

await prisma.$disconnect();
