import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (session?.user && (session.user as any).role === 'ADMIN') return true;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  return token?.role === 'ADMIN';
}

/// Лог подій життєвого циклу акаунтів ADMIN/MANAGER
/// (створення / видалення / відновлення).
export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) {
      return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
    }

    const events = await prisma.userAuditLog.findMany({
      where: { targetRole: { in: ['ADMIN', 'MANAGER'] } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        userId: true,
        eventType: true,
        targetName: true,
        targetEmail: true,
        targetRole: true,
        actorName: true,
        actorEmail: true,
        createdAt: true,
        user: { select: { image: true, deletedAt: true } },
      },
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Помилка отримання історії:', error);
    return NextResponse.json({ error: 'Помилка сервера' }, { status: 500 });
  }
}
