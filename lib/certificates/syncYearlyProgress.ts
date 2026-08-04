/// Спільна логіка синхронізації прогресу Річної програми з SendPulse.
/// Тягне прогрес ВСІХ студентів курсу `SENDPULSE_YEARLY_COURSE_ID`, оновлює
/// `YearlyProgramSubscription.spProgressPercent` для матчу по email і помічає
/// `spProgressCheckedAt` для ВСІХ активних підписок (для UI "SP: оновлено X тому").

import prisma from '@/lib/prisma';
import { fetchAllStudentsProgressForCourse } from '@/lib/sendpulse';
import { getYearlySendpulseCourseId } from '@/lib/yearlyProgramConfig';

export type YearlyProgressSyncResult = {
  ok: boolean;
  processed: number;
  /// Скільки підписок отримали відсутній `sendpulseStudentId` із ростера курсу.
  studentIdsFilled?: number;
  spStudents: number;
  errors: string[];
};

export async function syncYearlyProgress(): Promise<YearlyProgressSyncResult> {
  const errors: string[] = [];

  // Спершу з БД (AppSetting, редагується в адмінці), fallback на env SENDPULSE_YEARLY_COURSE_ID.
  const courseId = await getYearlySendpulseCourseId(prisma);
  if (!courseId || !Number.isFinite(courseId) || courseId <= 0) {
    return { ok: false, processed: 0, spStudents: 0, errors: ['SENDPULSE_YEARLY_COURSE_ID not set'] };
  }

  let students: Awaited<ReturnType<typeof fetchAllStudentsProgressForCourse>> = [];
  try {
    students = await fetchAllStudentsProgressForCourse(courseId);
  } catch (e) {
    return {
      ok: false,
      processed: 0,
      spStudents: 0,
      errors: [`fetchAll: ${(e as Error).message}`],
    };
  }

  const progressByEmail = new Map(
    students.map((s) => [s.email, Math.max(0, Math.min(100, Math.round(s.progressPercent)))]),
  );
  /// Побічний, але цінний продукт цього ж ростера: email → studentId у SendPulse.
  /// Ним добиваємо підписки, у яких `sendpulseStudentId` порожній (реєстрація сталась
  /// поза нашим флоу, lookup у момент оплати впав тощо). Без цього id закриття доступу
  /// в кінці grace робить зайвий пошук по всьому курсу, а якщо той не спрацює —
  /// підписка експайриться без реального закриття в SP.
  const idByEmail = new Map(students.map((s) => [s.email, s.studentId]));

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: { status: { not: 'CANCELLED' } },
    select: {
      id: true,
      sendpulseStudentId: true,
      user: { select: { email: true, deletedAt: true } },
    },
  });

  const now = new Date();

  // Помічаємо `spProgressCheckedAt = now` для ВСІХ живих підписок — навіть тих, кого
  // SP не повернув. Це щоб UI "SP: оновлено X тому" показувало факт запиту, а не лише
  // наявність даних.
  const liveSubIds = subs.filter((s) => !s.user.deletedAt).map((s) => s.id);
  if (liveSubIds.length > 0) {
    await prisma.yearlyProgramSubscription.updateMany({
      where: { id: { in: liveSubIds } },
      data: { spProgressCheckedAt: now },
    });
  }

  let processed = 0;
  let studentIdsFilled = 0;
  for (const sub of subs) {
    if (sub.user.deletedAt) continue;
    const email = sub.user.email.toLowerCase();
    const pct = progressByEmail.get(email);
    const spId = sub.sendpulseStudentId == null ? idByEmail.get(email) ?? null : null;
    if (pct == null && spId == null) continue;
    try {
      await prisma.yearlyProgramSubscription.update({
        where: { id: sub.id },
        data: {
          ...(pct != null ? { spProgressPercent: pct } : {}),
          ...(spId != null ? { sendpulseStudentId: spId } : {}),
        },
      });
      if (pct != null) processed += 1;
      if (spId != null) studentIdsFilled += 1;
    } catch (e) {
      errors.push(`${sub.id}: ${(e as Error).message}`);
    }
  }

  return {
    ok: errors.length === 0,
    processed,
    studentIdsFilled,
    spStudents: students.length,
    errors,
  };
}
