/// Щоденний cron: для кожного курсу з `sendpulseCourseId` —
///   1) тягне з SendPulse прогрес ВСІХ студентів і оновлює Enrollment.spProgressPercent
///      (для колонки "Курс завершено" в адмінці),
///   2) видає сертифікати тим, хто на 100% і ще без сертифіката.
///
/// Безкоштовні курси (`price === 0`) пропускаються — сертифікати лише для платних.
///
/// Прогін працює з часовим бюджетом і ротацією стартового курсу (див.
/// `syncCourseProgress`): генерація одного PDF — ~1.4 с і ~300 МБ RSS, тож за один
/// виклик усе не встигає. Недороблене підбирає наступний прохід, починаючи з того
/// курсу, на якому зупинились.

import { NextRequest, NextResponse } from 'next/server';
import { verifyBearer } from '@/lib/authTiming';
import { syncCourseProgress } from '@/lib/certificates/syncCourseProgress';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!verifyBearer(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const run = await syncCourseProgress({ actor: null });

  return NextResponse.json({
    ok: true,
    coursesProcessed: run.results.length,
    coursesTotal: run.coursesTotal,
    budgetExhausted: run.budgetExhausted,
    startedAtIndex: run.startedAtIndex,
    nextIndex: run.nextIndex,
    results: run.results,
    timestamp: new Date().toISOString(),
  });
}
