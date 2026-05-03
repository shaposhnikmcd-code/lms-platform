import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import { runExtraLaunchForSubscription } from '@/lib/yearlyProgramLaunch';

/// POST /api/admin/yearly-program/[id]/extra-launch
/// "Екстра Запуск нового студента" — індивідуальна версія 🚀 для одного manual-add студента,
/// додатого через invite-link після основного запуску cohort-у. Тонкий wrapper навколо
/// `runExtraLaunchForSubscription` (та сама логіка автоматично відпрацьовує і в callback-у
/// при первинній оплаті, якщо cohort вже launched).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }
  const actor = await getAdminActor(req);
  const actorLabel = actor?.email ?? actor?.name ?? 'admin';
  const { id } = await params;

  const result = await runExtraLaunchForSubscription(id, actorLabel);

  if (!result.ok) {
    const reason = result.reason ?? 'unknown';
    const statusByReason: Record<string, number> = {
      sub_not_found: 404,
      no_user_email: 400,
      no_cohort: 400,
      cohort_not_launched: 400,
      already_opened: 409,
      no_paid_payments: 400,
    };
    const errorByReason: Record<string, string> = {
      sub_not_found: 'Підписка не знайдена',
      no_user_email: 'У підписки немає користувача з email',
      no_cohort: 'Підписка не прив\'язана до cohort-у',
      cohort_not_launched: 'Cohort ще не запущений. Звичайний запуск через 🚀 Запустити програму.',
      already_opened: 'Доступ у SendPulse вже відкрито',
      no_paid_payments: 'У підписки ще немає оплачених платежів — лінк ще не використано або callback не прийшов',
    };
    const status = statusByReason[reason] ?? (reason.startsWith('sendpulse_open_failed') ? 502 : 400);
    const error = errorByReason[reason] ?? (reason.startsWith('sendpulse_open_failed') ? `SendPulse: ${reason.slice('sendpulse_open_failed:'.length)}` : reason);
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({
    ok: true,
    expiresAt: result.expiresAt,
    sendpulseAccessOpened: result.sendpulseAccessOpened,
    studentId: result.studentId,
    email: result.email,
  });
}
