import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { lessonId, watchedAt, completed } = await req.json();

    // Оновлюємо прогрес уроку
    const lessonProgress = await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: {
        userId,
        lessonId,
        watchedAt: watchedAt || 0,
        completed: completed || false,
        completedAt: completed ? new Date() : null,
      },
      update: {
        watchedAt: watchedAt || 0,
        completed: completed || false,
        completedAt: completed ? new Date() : null,
      },
    });

    // Якщо урок завершено — оновлюємо прогрес курсу
    if (completed) {
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: { module: { include: { course: { include: { modules: { include: { lessons: true } } } } } } },
      });

      if (lesson) {
        const courseId = lesson.module.courseId;
        const allLessons = lesson.module.course.modules.flatMap(m => m.lessons);
        const totalLessons = allLessons.length;

        const completedLessons = await prisma.lessonProgress.count({
          where: { userId, completed: true, lessonId: { in: allLessons.map(l => l.id) } },
        });

        const progressPercent = Math.round((completedLessons / totalLessons) * 100);

        await prisma.courseProgress.upsert({
          where: { userId_courseId: { userId, courseId } },
          create: {
            userId,
            courseId,
            lastLessonId: lessonId,
            progressPercent,
            completedAt: progressPercent === 100 ? new Date() : null,
          },
          update: {
            lastLessonId: lessonId,
            progressPercent,
            completedAt: progressPercent === 100 ? new Date() : null,
          },
        });

        // Якщо курс завершено — видаємо сертифікат
        if (progressPercent === 100) {
          await prisma.certificate.upsert({
            where: { userId_courseId: { userId, courseId } },
            create: { userId, courseId },
            update: {},
          });
        }
      }
    }

    return NextResponse.json({ success: true, lessonProgress });
  } catch (error) {
    console.error('Помилка збереження прогресу:', error);
    return NextResponse.json({ error: 'Помилка сервера' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { searchParams } = new URL(req.url);
    const lessonId = searchParams.get('lessonId');

    if (!lessonId) {
      return NextResponse.json({ error: 'lessonId обовязковий' }, { status: 400 });
    }

    const progress = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });

    return NextResponse.json({ progress });
  } catch (error) {
    console.error('Помилка отримання прогресу:', error);
    return NextResponse.json({ error: 'Помилка сервера' }, { status: 500 });
  }
}