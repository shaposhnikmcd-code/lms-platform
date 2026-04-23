import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const rows = await prisma.bundle.findMany({
  select: { id: true, title: true, sortOrder: true, createdAt: true },
  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
});
console.log('Rows:', rows.length);
for (const r of rows) {
  console.log(`  sortOrder=${String(r.sortOrder).padStart(4)}  createdAt=${r.createdAt.toISOString()}  ${r.title}`);
}
await prisma.$disconnect();
