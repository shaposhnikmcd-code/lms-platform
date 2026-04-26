/// Спільна логіка синхронізації прогресу Річної програми з SendPulse.
/// Тягне прогрес ВСІХ студентів курсу `SENDPULSE_YEARLY_COURSE_ID`, оновлює
/// `YearlyProgramSubscription.spProgressPercent` для матчу по email і помічає
/// `spProgressCheckedAt` для ВСІХ активних підписок (для UI "SP: оновлено X тому").

import prisma from '@/lib/prisma';
import { fetchAllStudentsProgressForCourse } from '@/lib/sendpulse';

export type YearlyProgressSyncResult = {
  ok: boolean;
  processed: number;
  spStudents: number;
  errors: string[];
};

export async function syncYearlyProgress(): Promise<YearlyProgressSyncResult> {
  const errors: string[] = [];

  const courseIdRaw = process.env.SENDPULSE_YEARLY_COURSE_ID;
  if (!courseIdRaw) {
    return { ok: false, processed: 0, spStudents: 0, errors: ['SENDPULSE_YEARLY_COURSE_ID not set'] };
  }
  const courseId = Number(courseIdRaw);
  if (!Number.isFinite(courseId) || courseId <= 0) {
    return {
      ok: false,
      processed: 0,
      spStudents: 0,
      errors: [`Invalid SENDPULSE_YEARLY_COURSE_ID: ${courseIdRaw}`],
    };
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

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: { status: { not: 'CANCELLED' } },
    select: {
      id: true,
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
  for (const sub of subs) {
    if (sub.user.deletedAt) continue;
    const email = sub.user.email.toLowerCase();
    const pct = progressByEmail.get(email);
    if (pct == null) continue;
    try {
      await prisma.yearlyProgramSubscription.update({
        where: { id: sub.id },
        data: { spProgressPercent: pct },
      });
      processed += 1;
    } catch (e) {
      errors.push(`${sub.id}: ${(e as Error).message}`);
    }
  }

  return {
    ok: errors.length === 0,
    processed,
    spStudents: students.length,
    errors,
  };
}
