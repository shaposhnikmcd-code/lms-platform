import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import CourseHero from "./_components/CourseHero";
import CourseTeachers from "./_components/CourseTeachers";
import CourseProgram from "./_components/CourseProgram";
import CoursePricing from "./_components/CoursePricing";
import CourseEnrolled from "./_components/CourseEnrolled";

type Props = {
  params: Promise<{ courseId: string }>;
};

export default async function CoursePage({ params }: Props) {
  const { courseId } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;

  const course = await prisma.course.findFirst({
    where: {
      OR: [{ slug: courseId }, { id: courseId }],
    },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: { orderBy: { order: "asc" } },
        },
      },
      courseTeachers: {
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
      },
      _count: { select: { enrollments: true } },
    },
  });

  if (!course) notFound();

  const enrollment =
    userId && userId !== "test-student-1"
      ? await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId, courseId: course.id } },
        })
      : null;

  const isEnrolled = !!enrollment;
  const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0);

  return (
    <main className="min-h-screen bg-white">
      <CourseHero
        course={course}
        courseId={courseId}
        isEnrolled={isEnrolled}
        totalLessons={totalLessons}
        enrollmentCount={course._count.enrollments}
      />
      {course.courseTeachers.length > 0 && (
        <CourseTeachers teachers={course.courseTeachers} />
      )}
      <CourseProgram
        modules={course.modules}
        totalLessons={totalLessons}
        isEnrolled={isEnrolled}
      />
      {isEnrolled ? (
        <CourseEnrolled courseId={courseId} />
      ) : (
        <CoursePricing
          course={course}
          totalLessons={totalLessons}
          isLoggedIn={!!session}
        />
      )}
    </main>
  );
}