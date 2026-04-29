import prisma from './_db.mjs';

/// Soft-delete всіх юзерів з role STUDENT або TEACHER (legacy ролі).
/// Зберігає Payment/Enrollment FK; юзер просто не може залогінитись і
/// не показується в /dashboard/admin/users.
const main = async () => {
  const targets = await prisma.user.findMany({
    where: { role: { in: ['STUDENT', 'TEACHER'] }, deletedAt: null },
    select: { id: true, email: true, role: true, _count: { select: { enrollments: true, payments: true } } },
  });

  console.log(`Знайдено ${targets.length} юзерів з role STUDENT/TEACHER (deletedAt=null):`);
  for (const u of targets) {
    console.log(`  - ${u.email} (${u.role}) · enrollments=${u._count.enrollments} payments=${u._count.payments}`);
  }

  if (process.argv.includes('--apply')) {
    const result = await prisma.user.updateMany({
      where: { role: { in: ['STUDENT', 'TEACHER'] }, deletedAt: null },
      data: {
        deletedAt: new Date(),
        deletedByEmail: 'system:role-cleanup',
        deletedByName: 'System (role cleanup)',
      },
    });
    console.log(`\n✅ Soft-deleted ${result.count} users.`);
  } else {
    console.log('\n[dry-run] Запусти з --apply щоб виконати soft-delete.');
  }
};

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
