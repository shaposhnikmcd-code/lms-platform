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
import type { CertCategory, CertLanguages, Certificate } from '@prisma/client';

/// Нормалізує пару (languages, recipientNameEn) до узгодженого стану, який пишемо
/// у БД і передаємо генератору:
///   • не задано languages → сумісний дефолт (є англ. ім'я → UK_EN, немає → UK);
///   • EN / UK_EN без англ. імені → помилка (PDF не має чим заповнити EN-сторінку);
///   • UK → англ. ім'я занулюємо, щоб у списках не з'являвся фантомний мовний бейдж.
function resolveLanguages(
  languages: CertLanguages | undefined,
  recipientNameEnRaw: string | null | undefined,
): { languages: CertLanguages; recipientNameEn: string | null } {
  const nameEn = recipientNameEnRaw?.trim() || null;
  const resolved: CertLanguages = languages ?? (nameEn ? 'UK_EN' : 'UK');
  if (resolved === 'UK') return { languages: 'UK', recipientNameEn: null };
  if (!nameEn) {
    throw new Error("Для англійської версії сертифіката потрібне ім'я латиницею.");
  }
  return { languages: resolved, recipientNameEn: nameEn };
}

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
  /// Англомовне ім'я — друкується на EN-сторінці. Обов'язкове для languages EN/UK_EN.
  recipientNameEn?: string;
  /// Які сторінки міститиме PDF: UK (тільки укр), UK_EN (дві), EN (тільки англ).
  /// Не задано → UK_EN якщо є англ. ім'я, інакше UK.
  languages?: CertLanguages;
  /// false — видати без листа: emailStatus лишається PENDING, лист шлеться пізніше
  /// через POST /api/admin/certificates/[id]/send. Default true.
  sendEmail?: boolean;
  actor: Actor;
};

/// Людські назви категорій Річної для логів подій і повідомлень адмінки.
const YEARLY_CATEGORY_LABELS: Record<CertCategory, string> = {
  LISTENER: 'Слухач',
  PRACTICAL: 'Практична участь',
  PARTICIPANT: 'Учасник',
};

export function yearlyCategoryLabel(category: CertCategory): string {
  return YEARLY_CATEGORY_LABELS[category];
}

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
  /// Англомовне ім'я — друкується на EN-сторінці.
  recipientNameEn?: string;
  /// Які сторінки міститиме PDF (див. `IssueYearlyCertInput.languages`).
  languages?: CertLanguages;
  /// false — без листа (emailStatus лишається PENDING). Default true.
  sendEmail?: boolean;
  actor: Actor;
}): Promise<Certificate> {
  const { userId, category, actor } = input;
  const sendEmail = input.sendEmail !== false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) throw new Error(`User not found: ${userId}`);

  const recipientName = (input.recipientName?.trim() || user.name?.trim() || user.email).trim();
  const { languages, recipientNameEn } = resolveLanguages(input.languages, input.recipientNameEn);
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
      recipientNameEn,
      languages,
      recipientEmail: user.email,
      issueYear,
      issuedManually: true,
      issuedByUserId: actor?.id ?? null,
      issuedByName: actor?.name ?? null,
      issuedByEmail: actor?.email ?? null,
      emailStatus: 'PENDING',
    },
  });

  await logEvent(
    certificate.id,
    'GENERATED',
    actor,
    `Видано вручну (Річна, ${YEARLY_CATEGORY_LABELS[category]}, без підписки)${sendEmail ? '' : ' — без відправки листа'}`,
  );

  if (sendEmail) await sendCertificateEmail(certificate, actor, false);

  return prisma.certificate.findUniqueOrThrow({ where: { id: certificate.id } });
}

/// Видача сертифіката Річної програми. Має snapshot-фактори — category, recipientName.
/// Перевіряє: для одного userId+subscriptionId не видаємо повторно (валідація в application code
/// бо Prisma не підтримує partial unique index).
export async function issueYearlyCertificate(input: IssueYearlyCertInput): Promise<Certificate> {
  const { userId, subscriptionId, category, actor } = input;
  const sendEmail = input.sendEmail !== false;

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
  const { languages, recipientNameEn } = resolveLanguages(input.languages, input.recipientNameEn);
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
      recipientNameEn,
      languages,
      recipientEmail: user.email,
      issueYear,
      issuedManually: true,
      issuedByUserId: actor?.id ?? null,
      issuedByName: actor?.name ?? null,
      issuedByEmail: actor?.email ?? null,
      emailStatus: 'PENDING',
    },
  });

  await logEvent(
    certificate.id,
    'GENERATED',
    actor,
    `Видано вручну (Річна, ${YEARLY_CATEGORY_LABELS[category]})${sendEmail ? '' : ' — без відправки листа'}`,
  );

  if (sendEmail) await sendCertificateEmail(certificate, actor, false);

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
  /// Прибираємо trailing " р." / " року" — modern editorial-форматування дати на сертифікаті.
  return formatted.replace(/\s*р(оку)?\.?$/i, '').trim();
}

/// Форматує тривалість як «2 години» / «1.5 години» / «5 годин» з коректним відмінком.
/// Використовується і у PDF body, і у тілі листа.
export function formatSupervisionHours(h: number | null | undefined): string | undefined {
  if (h === null || h === undefined) return undefined;
  if (!Number.isFinite(h) || h <= 0) return undefined;
  /// Округлюємо до 1 знаку після коми; цілі — без .0
  const rounded = Math.round(h * 10) / 10;
  const display = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
  if (!Number.isInteger(rounded)) return `${display} години`;
  const n = rounded;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${display} година`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${display} години`;
  return `${display} годин`;
}

/// Внутрішній helper — генерує PDF і шле лист. Оновлює emailStatus у БД і пише event.
async function sendCertificateEmail(cert: Certificate, actor: Actor, isResend: boolean): Promise<void> {
  try {
    const supervisionDateStr = formatSupervisionDate(cert.supervisionDate);
    const supervisionHoursStr = formatSupervisionHours(cert.supervisionHours);

    const pdfBytes = await generateCertificatePdf({
      templateKey: templateKeyFor(cert.type, cert.category),
      recipientName: cert.recipientName,
      /// Двомовний серт — це ОДИН PDF на дві сторінки, тому аттач лишається один.
      recipientNameEn: cert.recipientNameEn ?? undefined,
      /// Набір сторінок береться зі snapshot-у у БД: інакше EN-only сертифікат
      /// пішов би листом як двомовний.
      languages: cert.languages,
      issueYear: cert.issueYear,
      certNumber: cert.certNumber,
      verificationUrl: verificationUrl(cert.verificationToken),
      courseName: cert.courseName ?? undefined,
      category: cert.category ?? undefined,
      supervisionDate: supervisionDateStr,
      supervisionHours: supervisionHoursStr,
    });

    const pdfHash = hashPdfBytes(pdfBytes);

    const subject = certificateEmailSubject({
      recipientName: cert.recipientName,
      recipientEmail: cert.recipientEmail,
      type: cert.type,
      category: cert.category ?? undefined,
      courseName: cert.courseName ?? undefined,
      supervisionDate: supervisionDateStr,
      supervisionHours: supervisionHoursStr,
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
      supervisionHours: supervisionHoursStr,
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

/// Перша відправка листа для сертифіката, виданого без листа (emailStatus=PENDING)
/// або коли перша спроба впала (FAILED). Логується як SENT, не RESENT —
/// для отримувача це перший лист. Повторна відправка — `resendCertificate`.
export async function sendCertificateFirstEmail(certificateId: string, actor: Actor): Promise<void> {
  const cert = await prisma.certificate.findUniqueOrThrow({ where: { id: certificateId } });
  if (cert.revoked) throw new Error('Сертифікат відкликано, відправка заборонена.');
  if (cert.emailStatus === 'SENT') {
    throw new Error('Лист уже надіслано. Для повторної відправки скористайтесь «Перевідправити».');
  }
  await sendCertificateEmail(cert, actor, false);
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
  /// Тривалість заняття в годинах (Float). Опційна. Друкується поряд з датою.
  supervisionHours: number | null;
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
      supervisionHours: input.supervisionHours,
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
    recipientNameEn: cert.recipientNameEn ?? undefined,
    languages: cert.languages,
    issueYear: cert.issueYear,
    certNumber: cert.certNumber,
    verificationUrl: verificationUrl(cert.verificationToken),
    courseName: cert.courseName ?? undefined,
    category: cert.category ?? undefined,
    supervisionDate: formatSupervisionDate(cert.supervisionDate),
    supervisionHours: formatSupervisionHours(cert.supervisionHours),
  });
}
