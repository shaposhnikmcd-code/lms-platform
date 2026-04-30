import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env'), override: true });

const prisma = new PrismaClient();

const emails = [
  'shaposhnik.mcd@gmail.com',
  'andersen.pm2020@gmail.com',
  'Polandemigrants@gmail.com',
  'Andersen.BestPM@gmail.com',
];

const users = await prisma.user.findMany({
  where: { email: { in: emails } },
  select: { id: true, email: true, name: true, role: true },
});

for (const u of users) {
  console.log(`- ${u.email}  name="${u.name}"  role=${u.role}  id=${u.id}`);
}

await prisma.$disconnect();
