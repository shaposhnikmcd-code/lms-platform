/// Щоденний cron: шукає студентів, які пройшли курс на 100% у SendPulse, і видає
/// сертифікати тим, у кого ще немає. Пропускає курси без `sendpulseCourseId`
/// (авто-детекція без SP ID неможлива — такі курси видаються через адмінку вручну).
///
/// Безкоштовні курси (`price === 0`) пропускаються за специфікацією — сертифікати
/// лише для платних.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyBearer } from '@/lib/authTiming';
import { fetchCompletedStudentsForCourse } from '@/lib/sendpulse';
import { issueCourseCertificate } from '@/lib/certificates/service';

type CourseStepResult = {
  courseId: string;
  courseTitle: string;
  sendpulseCourseId: number;
  completedStudents: number;
  matchedUsers: number;
  newCertificates: number;
  skippedAlreadyIssued: number;
  errors: string[];
};

export async function GET(req: NextRequest) {
  if (!verifyBearer(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const courses = await prisma.course.findMany({
    where: {
      published: true,
      price: { gt: 0 },
      sendpulseCourseId: { not: null },
    },
    select: { id: true, title: true, sendpulseCourseId: true },
  });

  const results: CourseStepResult[] = [];

  for (const course of courses) {
    const res: CourseStepResult = {
      courseId: course.id,
      courseTitle: course.title,
      sendpulseCourseId: course.sendpulseCourseId!,
      completedStudents: 0,
      matchedUsers: 0,
      newCertificates: 0,
      skippedAlreadyIssued: 0,
      errors: [],
    };

    try {
      const completed = await fetchCompletedStudentsForCourse(course.sendpulseCourseId!);
      res.completedStudents = completed.length;
      if (completed.length === 0) {
        results.push(res);
        continue;
      }

      const emails = completed.map((s) => s.email);
      const users = await prisma.user.findMany({
        where: { email: { in: emails }, deletedAt: null },
        select: { id: true, email: true },
      });
      res.matchedUsers = users.length;
      const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));

      for (const student of completed) {
        const user = userByEmail.get(student.email);
        if (!user) continue;

        const existing = await prisma.certificate.findFirst({
          where: { userId: user.id, type: 'COURSE', courseId: course.id },
          select: { id: true },
        });
        if (existing) {
          res.skippedAlreadyIssued += 1;
          continue;
        }

        try {
          await issueCourseCertificate({
            userId: user.id,
            courseId: course.id,
            actor: null,
            issuedManually: false,
          });
          res.newCertificates += 1;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          res.errors.push(`${user.email}: ${msg}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.errors.push(`fetchCompleted: ${msg}`);
    }

    results.push(res);
  }

  return NextResponse.json({
    ok: true,
    coursesProcessed: courses.length,
    results,
    timestamp: new Date().toISOString(),
  });
}
