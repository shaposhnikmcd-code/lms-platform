/// Спільна логіка для cron `/api/cron/course-certificates` і manual-trigger
/// `/api/admin/certificates/run-course-cron`:
///   1) тягне з SendPulse прогрес ВСІХ студентів кожного курсу з `sendpulseCourseId`,
///   2) оновлює `Enrollment.spProgressPercent` + `spProgressCheckedAt` (для колонки
///      "Курс завершено" в адмінці),
///   3) видає сертифікат тим, хто має 100% і ще без сертифіката.
///
/// Одна видача коштує дорого: ~1.4 с генерації PDF і ~300 МБ RSS на пік (PDF ≈ 3 МБ).
/// Тому прогін працює з часовим бюджетом і не намагається встигнути все за раз —
/// краще чисто зупинитись і дообробити наступним проходом, ніж отримати 504/OOM
/// посеред циклу з половиною записаних станів.

import prisma from '@/lib/prisma';
import { fetchAllStudentsProgressForCourse } from '@/lib/sendpulse';
import { issueCourseCertificate } from '@/lib/certificates/service';

/// Курсор ротації: індекс курсу, з якого починає наступний прогін. Зберігаємо саме
/// індекс (а не id), бо `AppSetting.value` — Int. Порядок курсів стабільний
/// (`orderBy: id asc`), тож індекс однозначно вказує на місце в списку.
const ROTATION_KEY = 'certCourseCronCursor';

/// Скільки часу лишаємо на «дохвостити» — записати результат і повернути відповідь.
/// Нову видачу не починаємо, якщо до кінця бюджету менше цього.
const RESERVE_MS = 30_000;

/// Дефолтний бюджет прогону. maxDuration роутів = 300 с; лишаємо запас на холодний
/// старт і на серіалізацію відповіді.
const DEFAULT_BUDGET_MS = 240_000;

export type CourseSyncResult = {
  courseId: string;
  courseTitle: string;
  sendpulseCourseId: number;
  spStudents: number;
  matchedEnrollments: number;
  progressUpdated: number;
  newCertificates: number;
  skippedAlreadyIssued: number;
  /// Скільки кандидатів на видачу лишилось необробленими через вичерпаний бюджет.
  deferred: number;
  errors: string[];
};

export type CourseSyncRun = {
  results: CourseSyncResult[];
  /// true — бюджет часу вичерпався і частина курсів взагалі не оброблена цього разу.
  budgetExhausted: boolean;
  /// Скільки курсів підпадало під фільтр (не лише оброблених).
  coursesTotal: number;
  /// З якого індексу почали цей прогін і з якого почнеться наступний.
  startedAtIndex: number;
  nextIndex: number;
};

async function readCursor(): Promise<number> {
  const row = await prisma.appSetting.findUnique({ where: { key: ROTATION_KEY } });
  const v = row?.value ?? 0;
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

async function writeCursor(value: number): Promise<void> {
  await prisma.appSetting
    .upsert({ where: { key: ROTATION_KEY }, create: { key: ROTATION_KEY, value }, update: { value } })
    .catch(() => {
      /// Курсор — оптимізація, не факт бізнесу. Його втрата означає лише те, що
      /// наступний прогін знову почне з початку списку.
    });
}

export async function syncCourseProgress(options?: {
  onlyCourseId?: string | null;
  /// `null` — авто-видача йде без actor (system); інакше передається в audit.
  actor?: { id?: string | null; name?: string | null; email?: string | null } | null;
  /// Скільки часу максимум витрачати. За замовчуванням `DEFAULT_BUDGET_MS`.
  budgetMs?: number;
}): Promise<CourseSyncRun> {
  const onlyCourseId = options?.onlyCourseId ?? null;
  const actor = options?.actor ?? null;
  const deadline = Date.now() + (options?.budgetMs ?? DEFAULT_BUDGET_MS);
  const outOfBudget = () => Date.now() > deadline - RESERVE_MS;

  const allCourses = await prisma.course.findMany({
    where: {
      published: true,
      price: { gt: 0 },
      sendpulseCourseId: { not: null },
      ...(onlyCourseId ? { id: onlyCourseId } : {}),
    },
    orderBy: { id: 'asc' },
    select: { id: true, title: true, sendpulseCourseId: true },
  });

  /// Ротація стартової позиції. Без неї прогін щоразу починав з першого курсу, і
  /// «хвостові» курси голодували: бюджет вичерпувався на тих самих перших.
  /// Точковий запуск (onlyCourseId) курсор не рухає — це разова ручна дія.
  const rotate = !onlyCourseId && allCourses.length > 1;
  const startIndex = rotate ? (await readCursor()) % allCourses.length : 0;
  const courses = rotate
    ? [...allCourses.slice(startIndex), ...allCourses.slice(0, startIndex)]
    : allCourses;

  const results: CourseSyncResult[] = [];
  const now = new Date();
  let budgetExhausted = false;
  let processed = 0;

  for (const course of courses) {
    if (outOfBudget()) {
      budgetExhausted = true;
      break;
    }
    processed += 1;

    const res: CourseSyncResult = {
      courseId: course.id,
      courseTitle: course.title,
      sendpulseCourseId: course.sendpulseCourseId!,
      spStudents: 0,
      matchedEnrollments: 0,
      progressUpdated: 0,
      newCertificates: 0,
      skippedAlreadyIssued: 0,
      deferred: 0,
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
        where: {
          courseId: course.id,
        },
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

          /// Видача — найдорожча операція циклу (PDF + Resend). Перевіряємо бюджет
          /// саме тут, щоб перерватись ДО початку генерації, а не посеред неї.
          if (outOfBudget()) {
            res.deferred += 1;
            budgetExhausted = true;
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

  const nextIndex = rotate ? (startIndex + processed) % allCourses.length : startIndex;
  if (rotate) await writeCursor(nextIndex);

  return {
    results,
    budgetExhausted,
    coursesTotal: allCourses.length,
    startedAtIndex: startIndex,
    nextIndex,
  };
}
