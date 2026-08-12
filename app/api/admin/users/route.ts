import { NextRequest, NextResponse } from 'next/server';
import type { UserRole } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { isProtectedAccount, isSuperAdmin } from '@/lib/superAdmin';

type AdminActor = { id?: string; name?: string | null; email?: string | null };

/// Аудит зміни ролі. Раніше подія жила лише рядком у Runtime Logs Vercel —
/// тобто зміна привілеїв не була видна ні в «Історії змін», ні поза 30-денним
/// вікном зберігання логів. Тепер це повноцінний запис `UserAuditLog`
/// (ROLE_CHANGED, `previousRole` → `targetRole`), як CREATED/DELETED/RESTORED.
/// Best-effort: збій запису аудиту не має відкочувати вже застосовану зміну ролі,
/// але має бути гучним у логах.
async function recordRoleChange(params: {
  actor: AdminActor;
  target: { id: string; name: string | null; email: string; role: UserRole };
  newRole: UserRole;
}): Promise<void> {
  try {
    await prisma.userAuditLog.create({
      data: {
        userId: params.target.id,
        eventType: 'ROLE_CHANGED',
        targetName: params.target.name,
        targetEmail: params.target.email,
        targetRole: params.newRole,
        previousRole: params.target.role,
        actorId: params.actor.id ?? null,
        actorName: params.actor.name ?? null,
        actorEmail: params.actor.email ?? null,
      },
    });
  } catch (e) {
    console.error(
      '[audit] ROLE_CHANGED не записано в UserAuditLog:',
      JSON.stringify({
        targetId: params.target.id,
        targetEmail: params.target.email,
        fromRole: params.target.role,
        toRole: params.newRole,
        actorEmail: params.actor.email ?? null,
      }),
      e,
    );
  }
}

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
      where: {
        role: { in: ['ADMIN', 'MANAGER'] },
        ...(deleted ? { deletedAt: { not: null } } : { deletedAt: null }),
      },
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
      await prisma.userAuditLog.create({
        data: {
          userId: updated.id,
          eventType: 'RESTORED',
          targetName: updated.name,
          targetEmail: updated.email,
          targetRole: updated.role,
          actorId: guard.actor.id ?? null,
          actorName: guard.actor.name ?? null,
          actorEmail: guard.actor.email ?? null,
        },
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

    const validRoles = ['ADMIN', 'MANAGER'];
    if (!validRoles.includes(newRole)) {
      return NextResponse.json({ error: 'Невалідна роль' }, { status: 400 });
    }

    // Ті самі гарди, що і в DELETE (defense in depth): зміна ролі — така ж
    // привілейована операція, як видалення, і без них через прямий PATCH можна
    // було понизити власника платформи або підвищити себе/чужого до ADMIN.
    const actor = guard.actor;
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!target) {
      return NextResponse.json({ error: 'Користувача не знайдено' }, { status: 404 });
    }

    // 1. Собі роль не міняємо (щоб адмін не зачинив сам себе поза адмінкою).
    const isSelf =
      (!!actor.id && actor.id === target.id) ||
      (!!actor.email && !!target.email && actor.email.toLowerCase() === target.email.toLowerCase());
    if (isSelf) {
      return NextResponse.json(
        { error: 'Не можна змінити роль власного акаунта' },
        { status: 400 }
      );
    }

    // 2. Захищені акаунти (вшитий список + SUPER_ADMIN_EMAILS) недоторканні.
    if (isProtectedAccount(target.email)) {
      return NextResponse.json(
        { error: 'Цей акаунт захищений — його роль змінити не можна.' },
        { status: 403 }
      );
    }

    const actorIsSuperAdmin = await isSuperAdmin(req);

    // 3. Чіпати роль чинного ADMIN може тільки супер-адмін.
    if (target.role === 'ADMIN' && !actorIsSuperAdmin) {
      return NextResponse.json(
        { error: 'Змінити роль іншого адміна може тільки супер-адмін.' },
        { status: 400 }
      );
    }

    // 4. Підвищення до ADMIN — теж тільки супер-адмін.
    if (newRole === 'ADMIN' && target.role !== 'ADMIN' && !actorIsSuperAdmin) {
      return NextResponse.json(
        { error: 'Призначити роль ADMIN може тільки супер-адмін.' },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    });

    if (target.role !== newRole) {
      await recordRoleChange({ actor, target, newRole });
    }

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

    const validRoles = ['ADMIN', 'MANAGER'];
    const userRole = validRoles.includes(role) ? role : 'MANAGER';

    // Створення/відновлення одразу з роллю ADMIN — той самий escalation-шлях, що
    // й PATCH, тому та сама вимога: тільки супер-адмін.
    if (userRole === 'ADMIN' && !(await isSuperAdmin(req))) {
      return NextResponse.json(
        { error: 'Створити акаунт з роллю ADMIN може тільки супер-адмін.' },
        { status: 400 }
      );
    }

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
        await prisma.userAuditLog.create({
          data: {
            userId: restored.id,
            eventType: 'RESTORED',
            targetName: restored.name,
            targetEmail: restored.email,
            targetRole: restored.role,
            actorId: guard.actor.id ?? null,
            actorName: guard.actor.name ?? null,
            actorEmail: guard.actor.email ?? null,
          },
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

    await prisma.userAuditLog.create({
      data: {
        userId: user.id,
        eventType: 'CREATED',
        targetName: user.name,
        targetEmail: user.email,
        targetRole: user.role,
        actorId: guard.actor.id ?? null,
        actorName: guard.actor.name ?? null,
        actorEmail: guard.actor.email ?? null,
      },
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

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true },
    });
    // Критичні акаунти — повна заборона видалення.
    if (isProtectedAccount(target?.email)) {
      return NextResponse.json(
        { error: 'Цей акаунт захищений і не може бути видалений.' },
        { status: 403 }
      );
    }
    // Видалити іншого ADMIN може тільки супер-адмін (захищені акаунти).
    const actorIsSuperAdmin = await isSuperAdmin(req);
    if (target?.role === 'ADMIN' && !actorIsSuperAdmin) {
      return NextResponse.json(
        { error: 'Видалити іншого адміна може тільки супер-адмін. Спершу зніміть роль ADMIN.' },
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

    await prisma.userAuditLog.create({
      data: {
        userId: updated.id,
        eventType: 'DELETED',
        targetName: updated.name,
        targetEmail: updated.email,
        targetRole: updated.role,
        actorId: actor.id ?? null,
        actorName: actor.name ?? null,
        actorEmail: actor.email ?? null,
      },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error('Помилка DELETE /api/admin/users:', error);
    return NextResponse.json({ error: 'Помилка сервера' }, { status: 500 });
  }
}
