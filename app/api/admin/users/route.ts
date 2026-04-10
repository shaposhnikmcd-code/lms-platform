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

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin();
    if ('error' in guard) return guard.error;

    const { name, email, role } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email обовʼязковий' }, { status: 400 });

    const validRoles = ['ADMIN', 'MANAGER', 'TEACHER', 'STUDENT'];
    const userRole = validRoles.includes(role) ? role : 'STUDENT';

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.deletedAt) {
        const restored = await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: name || existing.name,
            role: userRole,
            deletedAt: null,
            deletedById: null,
            deletedByName: null,
            deletedByEmail: null,
          },
          include: { _count: { select: { enrollments: true } } },
        });
        return NextResponse.json({ success: true, user: restored, restored: true });
      }
      return NextResponse.json({ error: 'Користувач з таким email вже існує' }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        name: name || null,
        email,
        role: userRole,
      },
      include: { _count: { select: { enrollments: true } } },
    });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Помилка POST /api/admin/users:', error);
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
