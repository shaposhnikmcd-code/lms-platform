import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const course = await prisma.course.findFirst({
    where: { title: { contains: 'Тестовий', mode: 'insensitive' } },
    include: {
      _count: {
        select: {
          enrollments: true,
          payments: true,
          certificates: true,
          progress: true,
          modules: true,
          courseTeachers: true,
          promoCodes: true,
        },
      },
    },
  });

  if (!course) {
    console.log('Курс "Тестовий" не знайдено — нічого видаляти.');
    process.exit(0);
  }

  console.log('Знайдено:', { id: course.id, slug: course.slug, title: course.title });
  console.log("Пов'язані записи:", course._count);

  const slug = course.slug ?? course.id;
  const bundles = await prisma.bundleCourse.findMany({
    where: { courseSlug: slug },
    include: { bundle: { select: { id: true, title: true } } },
  });

  if (bundles.length) {
    console.log('⛔ Курс у пакетах:', bundles.map((b) => b.bundle.title));
    console.log('Спершу прибери його з пакетів — скрипт нічого не чіпав.');
    process.exit(1);
  }

  const deleted = await prisma.course.delete({ where: { id: course.id } });
  console.log('✅ Видалено курс:', deleted.id, '—', deleted.title);
} finally {
  await prisma.$disconnect();
}
