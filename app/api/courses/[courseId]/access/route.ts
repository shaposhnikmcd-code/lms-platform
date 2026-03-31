import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { courseId } = await params;

    if (!session?.user) {
      return NextResponse.json({ hasAccess: false });
    }

    const userId = (session.user as any).id;

    // Перевіряємо enrollment
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
    });

    // Адміни і викладачі мають доступ до всіх курсів
    const role = (session.user as any).role;
    const hasAccess = !!enrollment || role === 'ADMIN' || role === 'TEACHER';

    return NextResponse.json({ hasAccess });
  } catch (error) {
    console.error('Помилка перевірки доступу:', error);
    return NextResponse.json({ hasAccess: false });
  }
}