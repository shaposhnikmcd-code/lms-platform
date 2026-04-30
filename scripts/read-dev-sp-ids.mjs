// One-off: prints sendpulseCourseId mapping from DEV branch.
// Reads via _db.mjs (which loads .env.local → dev branch).
import prisma from './_db.mjs';

const courses = await prisma.course.findMany({
  where: { sendpulseCourseId: { not: null } },
  select: { id: true, slug: true, title: true, sendpulseCourseId: true, published: true, price: true },
  orderBy: { title: 'asc' },
});

console.log(`DEV courses with sendpulseCourseId: ${courses.length}\n`);
for (const c of courses) {
  console.log(`- [${c.sendpulseCourseId}] ${c.title}  (slug=${c.slug}, id=${c.id}, published=${c.published}, price=${c.price})`);
}

await prisma.$disconnect();
