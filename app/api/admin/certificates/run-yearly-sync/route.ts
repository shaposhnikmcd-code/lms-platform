/// POST /api/admin/certificates/run-yearly-sync — manual trigger синхронізації прогресу
/// Річної програми з SendPulse. Аналогічно `run-course-cron`, тільки для річного курсу.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/certificates/adminAuth';
import { syncYearlyProgress } from '@/lib/certificates/syncYearlyProgress';

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const result = await syncYearlyProgress();

  return NextResponse.json({
    ok: result.ok,
    processed: result.processed,
    spStudents: result.spStudents,
    errors: result.errors,
    timestamp: new Date().toISOString(),
  });
}
