/// API сертифікатів Супервізії:
///   GET  — список усіх SUPERVISION-сертифікатів (для таблиці у адмінці).
///   POST — пакетна видача сертифікатів. Один POST = одне супервізійне заняття,
///          одна спільна тема + дата, але список учасників (name + email).
///
/// Семантика: супервізія проходить онлайн-мітингом для групи; після — менеджер
/// видає сертифікат КОЖНОМУ учаснику (часом до 50). API обробляє учасників
/// паралельно через `Promise.allSettled`, повертає окремо успішні та невдалі —
/// фронт може показати часткові помилки і дати повторну спробу лише невдалим.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/certificates/adminAuth';
import { issueSupervisionCertificate } from '@/lib/certificates/service';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const certs = await prisma.certificate.findMany({
    where: { type: 'SUPERVISION' },
    orderBy: { issuedAt: 'desc' },
    select: {
      id: true,
      certNumber: true,
      recipientName: true,
      recipientEmail: true,
      courseName: true,
      supervisionDate: true,
      supervisionHours: true,
      issueYear: true,
      issuedAt: true,
      issuedByName: true,
      issuedByEmail: true,
      emailStatus: true,
      emailSentAt: true,
      emailFromAddress: true,
      revoked: true,
    },
  });

  return NextResponse.json({ certificates: certs });
}

type RecipientInput = { name?: unknown; email?: unknown };

type FailedRow = { name: string; email: string; error: string };

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { topic, supervisionDate, supervisionHours, recipients } = (body ?? {}) as {
    topic?: string;
    supervisionDate?: string | null;
    supervisionHours?: number | string | null;
    recipients?: RecipientInput[];
  };

  /// Top-level валідація: тема й список учасників обовʼязкові
  const topicTrim = typeof topic === 'string' ? topic.trim() : '';
  if (!topicTrim) {
    return NextResponse.json({ error: 'Тема супервізії обовʼязкова' }, { status: 400 });
  }
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return NextResponse.json({ error: 'Не вказано жодного учасника' }, { status: 400 });
  }
  if (recipients.length > 100) {
    /// Стеля 100 — щоб не повісити сервер; реальний кейс ≤50
    return NextResponse.json({ error: 'Понад 100 учасників за раз — забагато' }, { status: 400 });
  }

  /// Дата — опційна, але якщо задана — має парситись
  let parsedDate: Date | null = null;
  if (supervisionDate) {
    const d = new Date(supervisionDate);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: 'Невалідна дата супервізії' }, { status: 400 });
    }
    parsedDate = d;
  }

  /// Тривалість — опційна. Float > 0, ≤ 24 (більше — точно помилка).
  let parsedHours: number | null = null;
  if (supervisionHours !== null && supervisionHours !== undefined && supervisionHours !== '') {
    const h = typeof supervisionHours === 'number' ? supervisionHours : parseFloat(String(supervisionHours).replace(',', '.'));
    if (!Number.isFinite(h) || h <= 0 || h > 24) {
      return NextResponse.json({ error: 'Невалідна тривалість (0 < год ≤ 24)' }, { status: 400 });
    }
    parsedHours = h;
  }

  /// Per-recipient валідація: до запуску issuance — щоб явні помилки повідомити одразу,
  /// без створення часткових сертифікатів. Зберігаємо порядок для подальшого matching.
  type Normalized = { name: string; email: string; preError: string | null };
  const normalized: Normalized[] = recipients.map((r): Normalized => {
    const name = typeof r?.name === 'string' ? r.name.trim() : '';
    const email = typeof r?.email === 'string' ? r.email.trim() : '';
    let preError: string | null = null;
    if (!name) preError = "Імʼя порожнє";
    else if (!email) preError = 'Email порожній';
    else if (!EMAIL_RE.test(email)) preError = 'Невалідний email';
    return { name, email, preError };
  });

  /// Видача — паралельно через Promise.allSettled. Кожен сертифікат зберігається
  /// у БД, шле лист, лочиться certNumber атомарно. Невдача одного НЕ ламає інших.
  const results = await Promise.allSettled(
    normalized.map(async (r) => {
      if (r.preError) throw new Error(r.preError);
      return issueSupervisionCertificate({
        recipientName: r.name,
        recipientEmail: r.email,
        topic: topicTrim,
        supervisionDate: parsedDate,
        supervisionHours: parsedHours,
        actor: guard.actor,
      });
    }),
  );

  const issued: { id: string; email: string; certNumber: string }[] = [];
  const failed: FailedRow[] = [];

  results.forEach((res, i) => {
    const r = normalized[i];
    if (res.status === 'fulfilled') {
      issued.push({ id: res.value.id, email: r.email, certNumber: res.value.certNumber });
    } else {
      failed.push({
        name: r.name,
        email: r.email,
        error: res.reason instanceof Error ? res.reason.message : String(res.reason),
      });
    }
  });

  return NextResponse.json({
    issued: issued.length,
    issuedDetails: issued,
    failed,
  });
}
