import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const since = new Date(Date.now() - 36 * 60 * 60 * 1000);

const paid = await prisma.payment.findMany({
  where: { paidAt: { gte: since } },
  orderBy: { paidAt: 'desc' },
  include: {
    user: { select: { email: true } },
    bundle: { select: { slug: true } },
  },
});

console.log(`Платежів з paidAt за останні 36 год: ${paid.length}\n`);
for (const p of paid) {
  const kyiv = new Date(p.paidAt.getTime() + 3 * 60 * 60 * 1000);
  const kind = p.bundleId ? `BUNDLE(${p.bundle?.slug})` : `COURSE(${p.courseId})`;
  console.log(
    `UTC ${p.paidAt.toISOString()} | Kyiv ${kyiv.toISOString().slice(11, 19)} | ${kind.padEnd(40)} ${String(p.amount).padStart(6)} UAH  ${p.user?.email}`,
  );
}

await prisma.$disconnect();
