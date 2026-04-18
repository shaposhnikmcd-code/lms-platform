import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params;

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Урок не знайдено' }, { status: 404 });
    }

    // Paywall: безкоштовні уроки — відкриті. Для платних — потрібна сесія й (enrollment або ADMIN/TEACHER).
    if (!lesson.isFree) {
      const session = await getServerSession(authOptions);
      const user = session?.user as { id?: string; role?: string } | undefined;
      if (!user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const isPrivileged = user.role === 'ADMIN' || user.role === 'TEACHER';
      if (!isPrivileged) {
        const enrollment = await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId: user.id, courseId: lesson.module.courseId } },
        });
        if (!enrollment) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    }

    return NextResponse.json({ lesson });
  } catch (error) {
    console.error('Помилка отримання уроку:', error);
    return NextResponse.json({ error: 'Помилка сервера' }, { status: 500 });
  }
}
