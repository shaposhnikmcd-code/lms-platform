import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Знаходимо курси студента
  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    select: { courseId: true },
  });

  const courseIds = enrollments.map((e) => e.courseId);

  // Знаходимо викладачів цих курсів
  const courseTeachers = await prisma.courseTeacher.findMany({
    where: { courseId: { in: courseIds } },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  // Унікальні викладачі
  const uniqueTeachers = Array.from(
    new Map(courseTeachers.map((ct) => [ct.user.id, ct.user])).values()
  );

  return NextResponse.json(uniqueTeachers);
}