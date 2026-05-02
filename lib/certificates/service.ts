/// Core-сервіс сертифікатів: видача, відправка листа, відклик, перевідправка.
/// Вся логіка DB + PDF + email + event log тримається тут — route handlers тільки
/// роблять тонкий шар auth + валідацію + виклик цих функцій.

import prisma from '@/lib/prisma';
import { sendEmail, appBaseUrl, MAILER_FROM_EMAIL } from '@/lib/mailer';
import { certificateEmailHtml, certificateEmailSubject } from '@/lib/emailTemplates/certificate';
import { generateCertificatePdf } from './generatePdf';
import { generateCertNumber, newVerificationToken, hashPdfBytes } from './identifiers';
import { certificateFilenameAscii } from './filename';
import { templateKeyFor } from './templateConfig';
import type { CertCategory, Certificate } from '@prisma/client';

type Actor = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
} | null;

/// Публічний URL сертифіката (QR веде сюди; відповідна публічна сторінка під `/[locale]/certificate/{token}`).
export function verificationUrl(token: string): string {
  return `${appBaseUrl()}/uk/certificate/${token}`;
}

async function logEvent(
  certificateId: string,
  action: string,
  actor: Actor,
  message?: string,
  metadata?: Record<string, unknown>,
) {
  await prisma.certificateEvent.create({
    data: {
      certificateId,
      action,
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      actorEmail: actor?.email ?? null,
      message: message ?? null,
      metadata: metadata ? (metadata as object) : undefined,
    },
  });
}

export type IssueCourseCertInput = {
  userId: string;
  courseId: string;
  recipientName?: string; // override; default = User.name || User.email
  actor: Actor; // null = system (cron)
  issuedManually: boolean;
};

export type IssueYearlyCertInput = {
  userId: string;
  subscriptionId: string;
  category: CertCategory;
  recipientName?: string; // override; default = User.name
  actor: Actor;
};

/// Видача курсового сертифіката. Ідемпотентно по (userId, COURSE, courseId) — якщо
/// вже виданий і не revoked, повертає існуючий і НЕ шле листа повторно.
export async function issueCourseCertificate(input: IssueCourseCertInput): Promise<Certificate> {
  const { userId, courseId, actor, issuedManually } = input;

  const existing = await prisma.certificate.findFirst({
    where: { userId, type: 'COURSE', courseId, revoked: false },
  });
  if (existing) return existing;

  const [user, course] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } }),
    prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true } }),
  ]);
  if (!user) throw new Error(`User not found: ${userId}`);
  if (!course) throw new Error(`Course not found: ${courseId}`);

  const recipientName = (input.recipientName?.trim() || user.name?.trim() || user.email).trim();
  const issueYear = new Date().getUTCFullYear();
  const certNumber = await generateCertNumber('COURSE', issueYear);
  const verificationToken = newVerificationToken();

  const certificate = await prisma.certificate.create({
    data: {
      certNumber,
      verificationToken,
      type: 'COURSE',
      userId,
      courseId,
      recipientName,
      recipientEmail: user.email,
      courseName: course.title,
      issueYear,
      issuedManually,
      issuedByUserId: actor?.id ?? null,
      issuedByName: actor?.name ?? null,
      issuedByEmail: actor?.email ?? null,
      emailStatus: 'PENDING',
    },
  });

  await logEvent(certificate.id, 'GENERATED', actor, issuedManually ? 'Видано вручну (COURSE)' : 'Видано автоматично (cron)');

  await sendCertificateEmail(certificate, actor, /* isResend */ false);

  return prisma.certificate.findUniqueOrThrow({ where: { id: certificate.id } });
}

/// Видача "персонального" Річного сертифіката без привʼязки до підписки. Для випадків,
/// коли учасник не купував Річну програму через сайт (офлайн домовленість, спецдомовленість).
/// Дублі контролює route — partial unique index на Certificate не покриває (userId, type) для
/// YEARLY_PROGRAM (там немає courseId), тому валідація в application code.
export async function issueManualYearlyCertificate(input: {
  userId: string;
  category: CertCategory;
  recipientName?: string;
  actor: Actor;
}): Promise<Certificate> {
  const { userId, category, actor } = input;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) throw new Error(`User not found: ${userId}`);

  const recipientName = (input.recipientName?.trim() || user.name?.trim() || user.email).trim();
  const issueYear = new Date().getUTCFullYear();
  const certNumber = await generateCertNumber('YEARLY_PROGRAM', issueYear);
  const verificationToken = newVerificationToken();

  const certificate = await prisma.certificate.create({
    data: {
      certNumber,
      verificationToken,
      type: 'YEARLY_PROGRAM',
      category,
      userId,
      subscriptionId: null,
      recipientName,
      recipientEmail: user.email,
      issueYear,
      issuedManually: true,
      issuedByUserId: actor?.id ?? null,
      issuedByName: actor?.name ?? null,
      issuedByEmail: actor?.email ?? null,
      emailStatus: 'PENDING',
    },
  });

  await logEvent(certificate.id, 'GENERATED', actor, `Видано вручну (Річна, ${category === 'LISTENER' ? 'Слухач' : 'Практична участь'}, без підписки)`);

  await sendCertificateEmail(certificate, actor, false);

  return prisma.certificate.findUniqueOrThrow({ where: { id: certificate.id } });
}

/// Видача сертифіката Річної програми. Має snapshot-фактори — category, recipientName.
/// Перевіряє: для одного userId+subscriptionId не видаємо повторно (валідація в application code
/// бо Prisma не підтримує partial unique index).
export async function issueYearlyCertificate(input: IssueYearlyCertInput): Promise<Certificate> {
  const { userId, subscriptionId, category, actor } = input;

  const existing = await prisma.certificate.findFirst({
    where: { userId, type: 'YEARLY_PROGRAM', subscriptionId, revoked: false },
  });
  if (existing) {
    throw new Error('Сертифікат для цієї підписки вже виданий. Щоб видати повторно — відкличте попередній.');
  }

  const [user, sub] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } }),
    prisma.yearlyProgramSubscription.findUnique({ where: { id: subscriptionId }, select: { id: true, userId: true } }),
  ]);
  if (!user) throw new Error(`User not found: ${userId}`);
  if (!sub) throw new Error(`Subscription not found: ${subscriptionId}`);
  if (sub.userId !== userId) throw new Error('Subscription does not belong to this user');

  const recipientName = (input.recipientName?.trim() || user.name?.trim() || user.email).trim();
  const issueYear = new Date().getUTCFullYear();
  const certNumber = await generateCertNumber('YEARLY_PROGRAM', issueYear);
  const verificationToken = newVerificationToken();

  const certificate = await prisma.certificate.create({
    data: {
      certNumber,
      verificationToken,
      type: 'YEARLY_PROGRAM',
      category,
      userId,
      subscriptionId,
      recipientName,
      recipientEmail: user.email,
      issueYear,
      issuedManually: true,
      issuedByUserId: actor?.id ?? null,
      issuedByName: actor?.name ?? null,
      issuedByEmail: actor?.email ?? null,
      emailStatus: 'PENDING',
    },
  });

  await logEvent(certificate.id, 'GENERATED', actor, `Видано вручну (Річна, ${category === 'LISTENER' ? 'Слухач' : 'Практична участь'})`);

  await sendCertificateEmail(certificate, actor, false);

  return prisma.certificate.findUniqueOrThrow({ where: { id: certificate.id } });
}

/// Форматує дату супервізії як «12 травня 2026 року» — для тіла PDF та email.
/// Цей формат читається елегантніше в академічному документі, ніж "12.05.2026".
function formatSupervisionDate(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  const formatted = new Date(d).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  /// Прибираємо trailing " р." якщо locale його додає, щоб контрольовано додати "року".
  return formatted.replace(/\s*р\.?$/, '').trim() + ' року';
}

/// Внутрішній helper — генерує PDF і шле лист. Оновлює emailStatus у БД і пише event.
async function sendCertificateEmail(cert: Certificate, actor: Actor, isResend: boolean): Promise<void> {
  try {
    const supervisionDateStr = formatSupervisionDate(cert.supervisionDate);

    const pdfBytes = await generateCertificatePdf({
      templateKey: templateKeyFor(cert.type, cert.category),
      recipientName: cert.recipientName,
      issueYear: cert.issueYear,
      certNumber: cert.certNumber,
      verificationUrl: verificationUrl(cert.verificationToken),
      courseName: cert.courseName ?? undefined,
      category: cert.category ?? undefined,
      supervisionDate: supervisionDateStr,
    });

    const pdfHash = hashPdfBytes(pdfBytes);

    const subject = certificateEmailSubject({
      recipientName: cert.recipientName,
      recipientEmail: cert.recipientEmail,
      type: cert.type,
      category: cert.category ?? undefined,
      courseName: cert.courseName ?? undefined,
      supervisionDate: supervisionDateStr,
      certNumber: cert.certNumber,
      verificationUrl: verificationUrl(cert.verificationToken),
      issueYear: cert.issueYear,
    });

    const html = certificateEmailHtml({
      recipientName: cert.recipientName,
      recipientEmail: cert.recipientEmail,
      type: cert.type,
      category: cert.category ?? undefined,
      courseName: cert.courseName ?? undefined,
      supervisionDate: supervisionDateStr,
      certNumber: cert.certNumber,
      verificationUrl: verificationUrl(cert.verificationToken),
      issueYear: cert.issueYear,
    });

    const result = await sendEmail({
      to: cert.recipientEmail,
      subject,
      html,
      replyTo: 'edu@uimp.com.ua',
      attachments: [
        {
          // ASCII-only щоб iPhone Mail / Outlook коректно показували назву аттача.
          // Кирилиця у MIME-headers подекуди не декодується клієнтами.
          filename: certificateFilenameAscii(cert),
          content: Buffer.from(pdfBytes),
          contentType: 'application/pdf',
        },
      ],
    });

    if (result.ok) {
      await prisma.certificate.update({
        where: { id: cert.id },
        data: {
          emailStatus: 'SENT',
          emailSentAt: new Date(),
          emailMessageId: result.messageId ?? null,
          emailFromAddress: MAILER_FROM_EMAIL,
          emailError: null,
          pdfHash,
        },
      });
      await logEvent(cert.id, isResend ? 'RESENT' : 'SENT', actor, `Лист відправлено на ${cert.recipientEmail}`);
    } else {
      await prisma.certificate.update({
        where: { id: cert.id },
        data: { emailStatus: 'FAILED', emailError: result.error ?? 'Unknown error' },
      });
      await logEvent(cert.id, 'EMAIL_FAILED', actor, result.error ?? 'Unknown error');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.certificate.update({
      where: { id: cert.id },
      data: { emailStatus: 'FAILED', emailError: msg },
    });
    await logEvent(cert.id, 'EMAIL_FAILED', actor, msg);
    throw err;
  }
}

/// Перевідправка листа — регенерує PDF, шле заново. emailStatus → SENT/FAILED.
export async function resendCertificate(certificateId: string, actor: Actor): Promise<void> {
  const cert = await prisma.certificate.findUniqueOrThrow({ where: { id: certificateId } });
  if (cert.revoked) throw new Error('Сертифікат відкликано, перевідправка заборонена.');
  await sendCertificateEmail(cert, actor, true);
}

/// Revoke — помічаємо як відкликаний, НЕ видаляємо. Публічна верифікація показуватиме red banner.
export async function revokeCertificate(certificateId: string, actor: Actor, reason?: string): Promise<void> {
  const cert = await prisma.certificate.findUniqueOrThrow({ where: { id: certificateId } });
  if (cert.revoked) return;
  await prisma.certificate.update({
    where: { id: certificateId },
    data: {
      revoked: true,
      revokedAt: new Date(),
      revokedByUserId: actor?.id ?? null,
      revokedByName: actor?.name ?? null,
      revokedReason: reason ?? null,
    },
  });
  await logEvent(certificateId, 'REVOKED', actor, reason ?? 'Без коментаря');
}

/// Видача сертифіката супервізії. Менеджер вписує тему, дату (опційно) і email отримувача.
/// Якщо юзера з таким email немає — створюємо новий запис User (як у course/manual).
/// Дублі НЕ блокуємо на рівні БД (partial unique index не покриває SUPERVISION з NULL courseId);
/// один учасник може відвідати кілька різних супервізій → це нормально.
export type IssueSupervisionCertInput = {
  recipientName: string;
  recipientEmail: string;
  /// Тема супервізії — друкується як subject у позиції courseName на шаблоні.
  topic: string;
  /// Дата проведення супервізійного заняття. Опційна — якщо не задана, body показує
  /// generic рядок "в Українському інституті..."
  supervisionDate: Date | null;
  actor: Actor;
};

export async function issueSupervisionCertificate(
  input: IssueSupervisionCertInput,
): Promise<Certificate> {
  const email = input.recipientEmail.trim().toLowerCase();
  const recipientName = input.recipientName.trim();
  const topic = input.topic.trim();
  if (!recipientName) throw new Error("Ім'я обов'язкове");
  if (!email) throw new Error("Email обов'язковий");
  if (!topic) throw new Error('Тема супервізії обовʼязкова');

  /// Лук-ап юзера case-insensitive, бо email зберігаємо в різному регістрі.
  let user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, name: true, email: true, deletedAt: true },
  });
  if (user?.deletedAt) {
    throw new Error(`Юзер з email ${user.email} в архіві. Відновіть або вкажіть інший email.`);
  }
  if (!user) {
    user = await prisma.user.create({
      data: { email, name: recipientName },
      select: { id: true, name: true, email: true, deletedAt: true },
    });
  }

  const issueYear = new Date().getUTCFullYear();
  const certNumber = await generateCertNumber('SUPERVISION', issueYear);
  const verificationToken = newVerificationToken();

  const certificate = await prisma.certificate.create({
    data: {
      certNumber,
      verificationToken,
      type: 'SUPERVISION',
      userId: user.id,
      courseId: null,
      subscriptionId: null,
      recipientName,
      recipientEmail: user.email,
      courseName: topic,
      supervisionDate: input.supervisionDate,
      issueYear,
      issuedManually: true,
      issuedByUserId: input.actor?.id ?? null,
      issuedByName: input.actor?.name ?? null,
      issuedByEmail: input.actor?.email ?? null,
      emailStatus: 'PENDING',
    },
  });

  await logEvent(
    certificate.id,
    'GENERATED',
    input.actor,
    `Видано вручну (Супервізія: ${topic})`,
  );

  await sendCertificateEmail(certificate, input.actor, false);

  return prisma.certificate.findUniqueOrThrow({ where: { id: certificate.id } });
}

/// Регенерація PDF за існуючим certRecord — для download endpoints. Без відправки листа.
export async function regeneratePdfBytes(cert: Certificate): Promise<Uint8Array> {
  return generateCertificatePdf({
    templateKey: templateKeyFor(cert.type, cert.category),
    recipientName: cert.recipientName,
    issueYear: cert.issueYear,
    certNumber: cert.certNumber,
    verificationUrl: verificationUrl(cert.verificationToken),
    courseName: cert.courseName ?? undefined,
    category: cert.category ?? undefined,
    supervisionDate: formatSupervisionDate(cert.supervisionDate),
  });
}
