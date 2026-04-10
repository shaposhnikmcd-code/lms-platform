import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: NextResponse.json({ error: 'Не авторизовано' }, { status: 401 }) };
  const role = (session.user as any).role;
  if (role !== 'ADMIN') return { error: NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 }) };
  return { session };
}

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin();
    if ('error' in guard) return guard.error;

    const deleted = req.nextUrl.searchParams.get('deleted') === '1';

    const users = await prisma.user.findMany({
      where: deleted ? { deletedAt: { not: null } } : { deletedAt: null },
      orderBy: deleted ? { deletedAt: 'desc' } : { createdAt: 'desc' },
      include: {
        _count: { select: { enrollments: true } },
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Помилка отримання користувачів:', error);
    return NextResponse.json({ error: 'Помилка сервера' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const guard = await requireAdmin();
    if ('error' in guard) return guard.error;

    const { userId, newRole, restore } = await req.json();
    if (!userId) return NextResponse.json({ error: 'userId обовязковий' }, { status: 400 });

    if (restore) {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { deletedAt: null, deletedById: null, deletedByName: null, deletedByEmail: null },
      });
      return NextResponse.json({ success: true, user: updated });
    }

    if (!newRole) return NextResponse.json({ error: 'newRole обовязковий' }, { status: 400 });

    const validRoles = ['ADMIN', 'MANAGER', 'TEACHER', 'STUDENT'];
    if (!validRoles.includes(newRole)) {
      return NextResponse.json({ error: 'Невалідна роль' }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Помилка PATCH /api/admin/users:', error);
    return NextResponse.json({ error: 'Помилка сервера' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const guard = await requireAdmin();
    if ('error' in guard) return guard.error;

    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: 'userId обовязковий' }, { status: 400 });

    const actor = guard.session!.user as any;
    if (actor.id === userId) {
      return NextResponse.json({ error: 'Не можна видалити власний акаунт' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        deletedById: actor.id ?? null,
        deletedByName: actor.name ?? null,
        deletedByEmail: actor.email ?? null,
      },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error('Помилка DELETE /api/admin/users:', error);
    return NextResponse.json({ error: 'Помилка сервера' }, { status: 500 });
  }
}
