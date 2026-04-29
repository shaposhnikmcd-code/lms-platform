/// Best-effort провіжинінг для course/bundle оплат: створення Enrollment-ів і відправка
/// SendPulse event-ів. Викликається з callback (після того як Payment.status став PAID)
/// і з reconciliation cron (`/api/cron/reconcile-payments`) — для догенерування того,
/// що не встигло виконатись у callback-у.
///
/// Idempotency:
/// - `enrollment.upsert` з unique key (userId, courseId) — створює раз, ігнорує дублі.
/// - SendPulse event надсилається лише якщо `Payment.sendpulseSentAt` ще NULL.
/// - На повний успіх ставимо `enrollmentsCompletedAt` + `sendpulseSentAt`. Recon бачить
///   обидва timestamps і не чіпає такий Payment.
///
/// Recon-cron на цій логіці може перезапускатись хоч раз на хвилину — нічого не задвоїться.

import prisma from '@/lib/prisma';
import type { Payment } from '@prisma/client';

export type ProvisioningResult = {
  enrollmentsCreated: string[];
  sendpulseSent: string[];
  errors: string[];
};

/// Обчислює список course-slug-ів, які мають отримати enrollment + SP event на основі
/// типу платежу (course | bundle). Single source of truth — використовується і у callback,
/// і у recon cron.
export async function computeExpectedSlugs(payment: Pick<Payment, 'courseId' | 'bundleId' | 'freeSlugs'>): Promise<string[]> {
  if (payment.bundleId) {
    const bundle = await prisma.bundle.findUnique({
      where: { id: payment.bundleId },
      include: { courses: true },
    });
    if (!bundle) return [];
    const paidSlugs = bundle.courses.filter((c) => !c.isFree).map((c) => c.courseSlug);
    if (bundle.type === 'CHOICE_FREE') {
      return [...new Set([...paidSlugs, ...(payment.freeSlugs ?? [])])];
    }
    const freeSlugs = bundle.courses.filter((c) => c.isFree).map((c) => c.courseSlug);
    return [...new Set([...paidSlugs, ...freeSlugs])];
  }
  if (payment.courseId) {
    return [payment.courseId];
  }
  return [];
}

/// Виконує best-effort частину callback-флоу: enrollment-и + SendPulse events.
/// Викликати ТІЛЬКИ після того як Payment.status вже став PAID (атомарний flip).
///
/// На успіх — оновлює `enrollmentsCompletedAt` / `sendpulseSentAt` на Payment.
/// На помилку — оновлює `provisionError` і повертає список помилок (НЕ кидає).
/// Recon cron при наступному запуску побачить NULL timestamp і повторить спробу.
export async function provisionPayment(payment: Pick<Payment, 'id' | 'userId' | 'courseId' | 'bundleId' | 'freeSlugs' | 'amount' | 'enrollmentsCompletedAt' | 'sendpulseSentAt'>): Promise<ProvisioningResult> {
  const result: ProvisioningResult = {
    enrollmentsCreated: [],
    sendpulseSent: [],
    errors: [],
  };

  const slugs = await computeExpectedSlugs(payment);
  if (slugs.length === 0) {
    result.errors.push('no_expected_slugs');
    await prisma.payment.update({
      where: { id: payment.id },
      data: { provisionError: 'no_expected_slugs' },
    });
    return result;
  }

  const user = await prisma.user.findUnique({
    where: { id: payment.userId },
    select: { email: true },
  });
  if (!user) {
    result.errors.push('user_not_found');
    await prisma.payment.update({
      where: { id: payment.id },
      data: { provisionError: 'user_not_found' },
    });
    return result;
  }

  // 1) Enrollments — idempotent. Створюємо ВСЕ, накопичуємо помилки індивідуально.
  let enrollmentsAllOk = true;
  if (!payment.enrollmentsCompletedAt) {
    for (const slug of slugs) {
      try {
        await prisma.enrollment.upsert({
          where: { userId_courseId: { userId: payment.userId, courseId: slug } },
          create: { userId: payment.userId, courseId: slug },
          update: {},
        });
        result.enrollmentsCreated.push(slug);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        result.errors.push(`enrollment[${slug}]: ${msg.slice(0, 200)}`);
        enrollmentsAllOk = false;
      }
    }
  } else {
    enrollmentsAllOk = true;
  }

  // 2) SendPulse events — лише якщо ще не надсилались для цього Payment.
  // SendPulse webhook URL з env — без нього просто пропускаємо (env_missing — не помилка).
  const spEventUrl = process.env.SENDPULSE_EVENT_URL;
  let sendpulseAllOk = true;
  if (payment.sendpulseSentAt) {
    sendpulseAllOk = true;
  } else if (!spEventUrl) {
    result.errors.push('sendpulse_env_missing');
    sendpulseAllOk = false;
  } else if (!enrollmentsAllOk) {
    // Якщо enrollment-и не пройшли повністю — не шлемо SP, щоб не отримати кейс
    // "SP надіслано, але юзер у нашому LMS без enrollment". Recon retry потім.
    sendpulseAllOk = false;
  } else {
    for (const slug of slugs) {
      try {
        const res = await fetch(spEventUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            phone: '',
            product_name: slug,
            product_id: 0,
            product_price: Number(payment.amount),
            order_date: new Date().toISOString().split('T')[0],
          }),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        result.sendpulseSent.push(slug);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        result.errors.push(`sendpulse[${slug}]: ${msg.slice(0, 200)}`);
        sendpulseAllOk = false;
      }
    }
  }

  // 3) Оновлюємо timestamps + provisionError. Атомарне оновлення в одному запиті.
  const now = new Date();
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      ...(enrollmentsAllOk && !payment.enrollmentsCompletedAt ? { enrollmentsCompletedAt: now } : {}),
      ...(sendpulseAllOk && !payment.sendpulseSentAt ? { sendpulseSentAt: now } : {}),
      provisionError: result.errors.length > 0 ? result.errors.join('; ').slice(0, 1000) : null,
    },
  });

  return result;
}
