import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import { isSuperAdmin } from '@/lib/superAdmin';

/// Відмінити запуск cohort-у (super-admin only).
/// Логіка дзеркалить scripts/unlaunch-cohort.mjs варіант "A":
///   - очищає `launchedAt`, `launchScheduledFor`, `emailScheduledFor`
///   - НЕ закриває SendPulse-доступ у тих, кому вже відкрито
///   - НЕ змінює expiresAt підписок
///   - НЕ скасовує надіслані welcome-листи (emailSentAt лишається)
///
/// Тобто чисто прапорцеве віджимання — кнопка "🚀 Запустити" знову з'являється
/// в адмінці, можна перетестувати флоу або переналаштувати launch без втрати даних.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }
  if (!(await isSuperAdmin(req))) {
    return NextResponse.json({ error: 'Лише для Super Admin' }, { status: 403 });
  }
  const { id } = await params;

  const cohort = await prisma.yearlyProgramCohort.findUnique({ where: { id } });
  if (!cohort) {
    return NextResponse.json({ error: 'Cohort не знайдено' }, { status: 404 });
  }
  if (!cohort.launchedAt && !cohort.launchScheduledFor) {
    return NextResponse.json(
      { error: 'Cohort не запущено і не заплановано — нема що відмінити' },
      { status: 400 },
    );
  }

  const actor = (await getAdminActor(req))?.email ?? 'super-admin';
  const before = {
    launchedAt: cohort.launchedAt?.toISOString() ?? null,
    launchScheduledFor: cohort.launchScheduledFor?.toISOString() ?? null,
    emailScheduledFor: cohort.emailScheduledFor?.toISOString() ?? null,
  };

  await prisma.yearlyProgramCohort.update({
    where: { id },
    data: {
      launchedAt: null,
      launchScheduledFor: null,
      emailScheduledFor: null,
    },
  });

  // Аудит у Vercel logs (cohort-level подій-моделі немає).
  console.log(`[super-admin] unlaunch cohort ${id} (${cohort.name}) by ${actor}`, before);

  return NextResponse.json({ ok: true, cohortId: id, by: actor, before });
}
