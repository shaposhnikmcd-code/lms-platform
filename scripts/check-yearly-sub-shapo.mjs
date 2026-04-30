import prisma from './_db.mjs';

const subs = await prisma.yearlyProgramSubscription.findMany({
  where: { user: { email: 'shaposhnik.mcd@gmail.com' } },
  orderBy: { createdAt: 'desc' },
  select: {
    id: true,
    plan: true,
    status: true,
    autoRenew: true,
    recToken: true,
    expiresAt: true,
    createdAt: true,
    _count: { select: { payments: true, events: true } },
  },
});
console.log(JSON.stringify(subs, null, 2));
await prisma.$disconnect();
