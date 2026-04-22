import prisma from './_db.mjs';

const allPaid = await prisma.payment.findMany({
  where: { status: 'PAID' },
  orderBy: { paidAt: 'desc' },
  include: {
    user: { select: { email: true } },
    bundle: { select: { slug: true, title: true } },
  },
});

console.log(`Всього PAID платежів в БД: ${allPaid.length}\n`);
for (const p of allPaid) {
  const kind = p.bundleId ? `BUNDLE(${p.bundle?.slug})` : `COURSE(${p.courseId})`;
  console.log(
    `[${p.paidAt?.toISOString() || '?'}] ${kind.padEnd(45)} ${String(p.amount).padStart(6)} UAH  ${p.user?.email}  ${p.orderReference}`,
  );
}

console.log('\n--- Bundle courses in paid bundles ---');
const paidBundleIds = [...new Set(allPaid.filter((p) => p.bundleId).map((p) => p.bundleId))];
for (const bid of paidBundleIds) {
  const bc = await prisma.bundleCourse.findMany({ where: { bundleId: bid } });
  const b = await prisma.bundle.findUnique({ where: { id: bid } });
  console.log(`Bundle ${b?.slug} (${bid}): ${bc.map((c) => c.courseSlug).join(', ')}`);
}

await prisma.$disconnect();
