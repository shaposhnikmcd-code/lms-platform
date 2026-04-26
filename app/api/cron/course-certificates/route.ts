/// Щоденний cron: для кожного курсу з `sendpulseCourseId` —
///   1) тягне з SendPulse прогрес ВСІХ студентів і оновлює Enrollment.spProgressPercent
///      (для колонки "Курс завершено" в адмінці),
///   2) видає сертифікати тим, хто на 100% і ще без сертифіката.
///
/// Безкоштовні курси (`price === 0`) пропускаються — сертифікати лише для платних.

import { NextRequest, NextResponse } from 'next/server';
import { verifyBearer } from '@/lib/authTiming';
import { syncCourseProgress } from '@/lib/certificates/syncCourseProgress';

export async function GET(req: NextRequest) {
  if (!verifyBearer(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = await syncCourseProgress({ actor: null });

  return NextResponse.json({
    ok: true,
    coursesProcessed: results.length,
    results,
    timestamp: new Date().toISOString(),
  });
}
