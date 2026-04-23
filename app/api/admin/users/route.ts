import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

/// Захищені акаунти: критичні адміни, яких не можна видалити ні через UI,
/// ні через прямий API-виклик (defense in depth).
const PROTECTED_ACCOUNTS = new Set([
  'shaposhnik.mcd@gmail.com',
  'saposniktana878@gmail.com',
]);

type AdminActor = { id?: string; name?: string | null; email?: string | null };

async function requireAdmin(req: NextRequest): Promise<
  { actor: AdminActor } | { error: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (session?.user && (session.user as any).role === 'ADMIN') {
    return { actor: session.user as AdminActor };
  }
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (token?.role === 'ADMIN') {
    return {
      actor: {
        id: token.id as string | undefined,
        name: (token.name as string | null | undefined) ?? null,
        email: (token.email as string | null | undefined) ?? null,
      },
    };
  }
  return { error: NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 }) };
}

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if ('error' in guard) return guard.error;

    const deleted = req.nextUrl.searchParams.get('deleted') === '1';
    const MAX_USERS = 1000;

    const users = await prisma.user.findMany({
      where: deleted ? { deletedAt: { not: null } } : { deletedAt: null },
      orderBy: deleted ? { deletedAt: 'desc' } : { createdAt: 'desc' },
      take: MAX_USERS,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
        deletedAt: true,
        deletedByName: true,
        deletedByEmail: true,
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
    const guard = await requireAdmin(req);
    if ('error' in guard) return guard.error;

    const body = await req.json();
    const { userId, newRole, newName, restore } = body;
    if (!userId) return NextResponse.json({ error: 'userId обовязковий' }, { status: 400 });

    if (restore) {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { deletedAt: null, deletedById: null, deletedByName: null, deletedByEmail: null },
      });
      return NextResponse.json({ success: true, user: updated });
    }

    // Оновлення імені. `newName` може бути undefined (не передали) — тоді не чіпаємо;
    // null / порожній рядок → скидаємо імʼя в null; непорожній → trim + max 200.
    if ('newName' in body) {
      const raw = typeof newName === 'string' ? newName.trim() : '';
      if (raw.length > 200) {
        return NextResponse.json({ error: 'Імʼя занадто довге (максимум 200 символів)' }, { status: 400 });
      }
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { name: raw || null },
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
    const guard = await requireAdmin(req);
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

    // Юзер створюється без пароля. Перший логін зафіксує введений пароль
    // як постійний (first-login-claim, див. lib/auth.ts). Адмін просто каже
    // новому користувачеві email → той йде на /login → вводить пароль.
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
    const guard = await requireAdmin(req);
    if ('error' in guard) return guard.error;

    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: 'userId обовязковий' }, { status: 400 });

    const actor = guard.actor;
    if (actor.id === userId) {
      return NextResponse.json({ error: 'Не можна видалити власний акаунт' }, { status: 400 });
    }

    // Захист від lockout: ADMIN не може soft-delete іншого ADMIN. Якщо треба зняти права —
    // спершу PATCH { newRole: 'STUDENT' }, потім DELETE.
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true },
    });
    // Критичні акаунти — повна заборона видалення.
    if (target?.email && PROTECTED_ACCOUNTS.has(target.email.toLowerCase())) {
      return NextResponse.json(
        { error: 'Цей акаунт захищений і не може бути видалений.' },
        { status: 403 }
      );
    }
    if (target?.role === 'ADMIN') {
      return NextResponse.json(
        { error: 'Не можна видалити іншого адміна. Спершу зніміть роль ADMIN.' },
        { status: 400 }
      );
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
