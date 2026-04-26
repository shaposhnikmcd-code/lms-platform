/// Спільна логіка для cron `/api/cron/course-certificates` і manual-trigger
/// `/api/admin/certificates/run-course-cron`:
///   1) тягне з SendPulse прогрес ВСІХ студентів кожного курсу з `sendpulseCourseId`,
///   2) оновлює `Enrollment.spProgressPercent` + `spProgressCheckedAt` (для колонки
///      "Курс завершено" в адмінці),
///   3) видає сертифікат тим, хто має 100% і ще без сертифіката.

import prisma from '@/lib/prisma';
import { fetchAllStudentsProgressForCourse } from '@/lib/sendpulse';
import { issueCourseCertificate } from '@/lib/certificates/service';

export type CourseSyncResult = {
  courseId: string;
  courseTitle: string;
  sendpulseCourseId: number;
  spStudents: number;
  matchedEnrollments: number;
  progressUpdated: number;
  newCertificates: number;
  skippedAlreadyIssued: number;
  errors: string[];
};

export async function syncCourseProgress(options?: {
  onlyCourseId?: string | null;
  /// `null` — авто-видача йде без actor (system); інакше передається в audit.
  actor?: { id?: string | null; name?: string | null; email?: string | null } | null;
}): Promise<CourseSyncResult[]> {
  const onlyCourseId = options?.onlyCourseId ?? null;
  const actor = options?.actor ?? null;

  const courses = await prisma.course.findMany({
    where: {
      published: true,
      price: { gt: 0 },
      sendpulseCourseId: { not: null },
      ...(onlyCourseId ? { id: onlyCourseId } : {}),
    },
    select: { id: true, title: true, sendpulseCourseId: true },
  });

  const results: CourseSyncResult[] = [];
  const now = new Date();

  for (const course of courses) {
    const res: CourseSyncResult = {
      courseId: course.id,
      courseTitle: course.title,
      sendpulseCourseId: course.sendpulseCourseId!,
      spStudents: 0,
      matchedEnrollments: 0,
      progressUpdated: 0,
      newCertificates: 0,
      skippedAlreadyIssued: 0,
      errors: [],
    };

    try {
      const allStudents = await fetchAllStudentsProgressForCourse(course.sendpulseCourseId!);
      res.spStudents = allStudents.length;

      // Map by email — швидкий лук-ап під час оновлення enrollments.
      const progressByEmail = new Map(
        allStudents.map((s) => [s.email, Math.max(0, Math.min(100, Math.round(s.progressPercent)))]),
      );

      // Тягнемо всіх enrolled у цей курс.
      const enrollments = await prisma.enrollment.findMany({
        where: { courseId: course.id },
        select: {
          userId: true,
          user: { select: { email: true, deletedAt: true } },
        },
      });

      // Помічаємо ВСІ enrollments курсу як "перевірені у SP" (навіть тих, кого SP не
      // повернув). Це щоб у адмінці поле "SP: оновлено X тому" показувало факт запиту,
      // а не лише наявність даних. Прогрес (`spProgressPercent`) оновлюється нижче лише
      // для тих, у кого реально знайдено дані в SP.
      const liveEnrollmentUserIds = enrollments
        .filter((en) => !en.user.deletedAt)
        .map((en) => en.userId);
      if (liveEnrollmentUserIds.length > 0) {
        await prisma.enrollment.updateMany({
          where: { courseId: course.id, userId: { in: liveEnrollmentUserIds } },
          data: { spProgressCheckedAt: now },
        });
      }

      for (const en of enrollments) {
        if (en.user.deletedAt) continue;
        const email = en.user.email.toLowerCase();
        const pct = progressByEmail.get(email);
        if (pct == null) continue;

        res.matchedEnrollments += 1;

        try {
          await prisma.enrollment.update({
            where: { userId_courseId: { userId: en.userId, courseId: course.id } },
            data: { spProgressPercent: pct, spProgressCheckedAt: now },
          });
          res.progressUpdated += 1;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          res.errors.push(`progress ${email}: ${msg}`);
          continue;
        }

        if (pct >= 100) {
          const existing = await prisma.certificate.findFirst({
            where: { userId: en.userId, type: 'COURSE', courseId: course.id },
            select: { id: true },
          });
          if (existing) {
            res.skippedAlreadyIssued += 1;
            continue;
          }

          try {
            await issueCourseCertificate({
              userId: en.userId,
              courseId: course.id,
              actor,
              issuedManually: false,
            });
            res.newCertificates += 1;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            res.errors.push(`issue ${email}: ${msg}`);
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.errors.push(`fetchAllStudentsProgress: ${msg}`);
    }

    results.push(res);
  }

  return results;
}
