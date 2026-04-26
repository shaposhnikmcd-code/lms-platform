/// Core-сервіс сертифікатів: видача, відправка листа, відклик, перевідправка.
/// Вся логіка DB + PDF + email + event log тримається тут — route handlers тільки
/// роблять тонкий шар auth + валідацію + виклик цих функцій.

import prisma from '@/lib/prisma';
import { sendEmail, appBaseUrl } from '@/lib/mailer';
import { certificateEmailHtml, certificateEmailSubject } from '@/lib/emailTemplates/certificate';
import { generateCertificatePdf } from './generatePdf';
import { generateCertNumber, newVerificationToken, hashPdfBytes } from './identifiers';
import type { TemplateKey } from './templateConfig';
import type { CertCategory, CertificateType, Certificate } from '@prisma/client';

type Actor = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
} | null;

/// Публічний URL сертифіката (QR веде сюди; відповідна публічна сторінка під `/[locale]/certificate/{token}`).
export function verificationUrl(token: string): string {
  return `${appBaseUrl()}/uk/certificate/${token}`;
}

function templateKeyFor(type: CertificateType, category: CertCategory | null | undefined): TemplateKey {
  if (type === 'COURSE') return 'COURSE';
  return category === 'LISTENER' ? 'YEARLY_LISTENER' : 'YEARLY_PRACTICAL';
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

/// Внутрішній helper — генерує PDF і шле лист. Оновлює emailStatus у БД і пише event.
async function sendCertificateEmail(cert: Certificate, actor: Actor, isResend: boolean): Promise<void> {
  try {
    const pdfBytes = await generateCertificatePdf({
      templateKey: templateKeyFor(cert.type, cert.category),
      recipientName: cert.recipientName,
      issueYear: cert.issueYear,
      certNumber: cert.certNumber,
      verificationUrl: verificationUrl(cert.verificationToken),
      courseName: cert.courseName ?? undefined,
      category: cert.category ?? undefined,
    });

    const pdfHash = hashPdfBytes(pdfBytes);

    const subject = certificateEmailSubject({
      recipientName: cert.recipientName,
      recipientEmail: cert.recipientEmail,
      type: cert.type,
      category: cert.category ?? undefined,
      courseName: cert.courseName ?? undefined,
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
          filename: `certificate-${cert.certNumber}.pdf`,
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
  });
}
