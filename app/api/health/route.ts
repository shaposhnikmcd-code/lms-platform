/// Health check endpoint — використовується Vercel rolling deploy для перевірки що
/// новий instance готовий приймати трафік. Якщо повертає 503 — Vercel НЕ переключає
/// трафік на нову версію, стара продовжує обслуговувати клієнтів.
///
/// Що перевіряємо:
///   1) БД доступна (`SELECT 1`).
///   2) Schema-критичні колонки існують (через field selection, який провалить запит
///      з PostgresError 42703 якщо колонка відсутня).
///
/// Якщо який-небудь майбутній deploy додасть нову схема-залежність до hot-path-у,
/// додай поле сюди — Vercel захистить продакшен від "новий код + стара БД".

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, string> = {};
  let allOk = true;

  // 1) Базовий зв'язок із БД.
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = 'ok';
  } catch (e) {
    checks.db = `fail: ${(e as Error).message.slice(0, 200)}`;
    allOk = false;
  }

  // 2) Колонки `Payment.enrollmentsCompletedAt`, `sendpulseSentAt`, `provisionError` —
  //    від них залежить callback флоу і recon cron. findFirst без WHERE → Postgres перевіряє
  //    SELECT-list, і відсутня колонка одразу throw-не помилку.
  try {
    await prisma.payment.findFirst({
      select: {
        id: true,
        enrollmentsCompletedAt: true,
        sendpulseSentAt: true,
        provisionError: true,
      },
    });
    checks.payment_provisioning_columns = 'ok';
  } catch (e) {
    checks.payment_provisioning_columns = `fail: ${(e as Error).message.slice(0, 200)}`;
    allOk = false;
  }

  // 3) Колонки `Enrollment.spProgressPercent`/`spProgressCheckedAt` — від них залежить
  //    і callback (через provisionPayment.enrollment.upsert select), і course-certificates
  //    cron. Це саме та колонка, яка була пропущена 27-28.04.
  try {
    await prisma.enrollment.findFirst({
      select: {
        id: true,
        spProgressPercent: true,
        spProgressCheckedAt: true,
      },
    });
    checks.enrollment_sp_columns = 'ok';
  } catch (e) {
    checks.enrollment_sp_columns = `fail: ${(e as Error).message.slice(0, 200)}`;
    allOk = false;
  }

  return NextResponse.json(
    {
      ok: allOk,
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allOk ? 200 : 503 },
  );
}
