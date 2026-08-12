/// API сертифікатів Супервізії:
///   GET  — список усіх SUPERVISION-сертифікатів (для таблиці у адмінці).
///   POST — пакетна видача сертифікатів. Один POST = одне супервізійне заняття,
///          одна спільна тема + дата, але список учасників (name + email).
///
/// Семантика: супервізія проходить онлайн-мітингом для групи; після — менеджер
/// видає сертифікат КОЖНОМУ учаснику. Один сертифікат коштує ~1.4 с генерації PDF
/// (~3 МБ) і тримає ~300 МБ RSS на пік, тому:
///   • обробка йде чанками по `CONCURRENCY` (а не всі одразу — 40 паралельних
///     генерацій клали функцію по памʼяті ще до таймауту),
///   • є `maxDuration` замість дефолтних 10 с,
///   • ліміт учасників за один запит — `MAX_RECIPIENTS`; більше — менеджер розбиває
///     список (підказка приходить у тексті помилки).
///
/// Відповідь ділить учасників на ТРИ списки, а не два:
///   issued            — сертифікат створений, лист пішов;
///   issuedEmailFailed — сертифікат створений, лист НЕ пішов (треба дослати з таблиці);
///   failed            — сертифіката немає, рядок можна повторювати.
/// Раніше «лист не пішов» потрапляло у `failed`, менеджер повторював рядок — і людина
/// отримувала другий сертифікат з іншим номером.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/certificates/adminAuth';
import { issueSupervisionCertificate } from '@/lib/certificates/service';

export const maxDuration = 300;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/// Скільки сертифікатів генеруємо одночасно. Виміряно локально: 4 паралельні
/// генерації тримають пік ~300 МБ RSS — у межах ліміту serverless-функції.
/// Без обмеження всі 30-40 стартували разом і клали процес по памʼяті.
const CONCURRENCY = 4;

/// Стеля учасників на один запит. Виміряно: 30 сертифікатів чанками по 4 —
/// ~39 с, тобто вчетверо менше за maxDuration. Запас свідомий: у проді додається
/// латентність Resend і холодний старт.
const MAX_RECIPIENTS = 30;

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

/// Сертифікат СТВОРЕНО. `emailError` заповнений → лист не пішов; рядок НЕ можна
/// повторювати, лист досилається кнопкою в таблиці «Супервізія».
type IssuedRow = {
  id: string;
  name: string;
  email: string;
  certNumber: string;
  emailError?: string;
};

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
  if (recipients.length > MAX_RECIPIENTS) {
    return NextResponse.json(
      {
        error:
          `За один раз — не більше ${MAX_RECIPIENTS} учасників (зараз ${recipients.length}). ` +
          `Розбийте список на частини по ${MAX_RECIPIENTS} і видайте кількома заходами: ` +
          'тема, дата й тривалість збережуться у чернетці.',
      },
      { status: 400 },
    );
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

  /// Видача чанками по CONCURRENCY: усередині чанка — паралельно (`allSettled`,
  /// невдача одного не ламає сусідів), між чанками — послідовно, щоб не тримати
  /// у памʼяті більше 4 PDF одночасно і не забивати Resend залпом.
  const results: PromiseSettledResult<Awaited<ReturnType<typeof issueSupervisionCertificate>>>[] = [];
  for (let i = 0; i < normalized.length; i += CONCURRENCY) {
    const chunk = normalized.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      chunk.map(async (r) => {
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
    results.push(...settled);
  }

  const issued: IssuedRow[] = [];
  const issuedEmailFailed: IssuedRow[] = [];
  const failed: FailedRow[] = [];

  results.forEach((res, i) => {
    const r = normalized[i];
    if (res.status === 'fulfilled') {
      const { certificate, email } = res.value;
      const row: IssuedRow = {
        id: certificate.id,
        name: r.name,
        email: r.email,
        certNumber: certificate.certNumber,
        emailError: email?.ok === false ? email.error ?? 'Лист не відправлено' : undefined,
      };
      if (email?.ok === false) issuedEmailFailed.push(row);
      else issued.push(row);
    } else {
      failed.push({
        name: r.name,
        email: r.email,
        error: res.reason instanceof Error ? res.reason.message : String(res.reason),
      });
    }
  });

  return NextResponse.json({
    /// `issued` історично = скільки сертифікатів створено. Лишаємо саме таку
    /// семантику (створені + ті, у кого не пішов лист), щоб лічильник у тості не
    /// занижував факт видачі.
    issued: issued.length + issuedEmailFailed.length,
    issuedDetails: issued,
    issuedEmailFailed,
    failed,
  });
}
