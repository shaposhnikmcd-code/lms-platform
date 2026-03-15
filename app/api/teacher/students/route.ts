import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const courseTeachers = await prisma.courseTeacher.findMany({
    where: { userId: session.user.id },
    select: { courseId: true },
  });

  const courseIds = courseTeachers.map((ct) => ct.courseId);

  const enrollments = await prisma.enrollment.findMany({
    where: { courseId: { in: courseIds } },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  // Унікальні студенти
  const uniqueStudents = Array.from(
    new Map(enrollments.map((e) => [e.user.id, e.user])).values()
  );

  return NextResponse.json(uniqueStudents);
}