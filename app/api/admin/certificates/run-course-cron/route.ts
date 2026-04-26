/// POST /api/admin/certificates/run-course-cron — manual trigger тієї самої логіки що
/// `/api/cron/course-certificates`. Дозволяє адміну швидко синхронізувати прогрес з SP
/// і видати сертифікати без очікування daily cron.
///
/// Зворотньо-сумісна форма відповіді (поле `completedStudents` лишається — = всі,
/// у кого progress > 0, тобто взагалі присутні в SP-курсі), плюс додаються поля для
/// нової логіки.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/certificates/adminAuth';
import { syncCourseProgress } from '@/lib/certificates/syncCourseProgress';

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const sp = req.nextUrl.searchParams;
  const onlyCourseId = sp.get('courseId');

  const results = await syncCourseProgress({
    onlyCourseId,
    actor: guard.actor,
  });

  // Форма для існуючого UI (поле `completedStudents` => spStudents).
  const legacyResults = results.map((r) => ({
    courseId: r.courseId,
    courseTitle: r.courseTitle,
    sendpulseCourseId: r.sendpulseCourseId,
    completedStudents: r.spStudents,
    matchedUsers: r.matchedEnrollments,
    progressUpdated: r.progressUpdated,
    newCertificates: r.newCertificates,
    skippedAlreadyIssued: r.skippedAlreadyIssued,
    errors: r.errors,
  }));

  return NextResponse.json({
    ok: true,
    coursesProcessed: results.length,
    results: legacyResults,
    timestamp: new Date().toISOString(),
  });
}
