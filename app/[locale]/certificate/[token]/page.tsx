/// Публічна сторінка верифікації сертифіката. Доступна всім (no auth).
/// QR-код з PDF веде сюди. Показує:
///   - Вбудований PDF-preview
///   - Ім'я получателя, номер, дата, тип (курс/річна), категорія
///   - "UIMP — Verified" badge
///   - Якщо revoked: червоний банер
///   - Посилання на курс або Річну програму

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { buildPageMetadata } from '@/lib/seo';
import { appBaseUrl } from '@/lib/mailer';
import { headers } from 'next/headers';
import { certificateFilename } from '@/lib/certificates/filename';
import { checkRateLimitRaw } from '@/lib/ratelimit';
import { clientIpFrom, logCertificateView } from '@/lib/certificates/viewLog';
import { DownloadButton } from './DownloadButton';
import { CertificatePreview } from './CertificatePreview';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string; token: string }>;
};

function formatDate(d: Date | string, locale: string): string {
  const date = new Date(d);
  const loc = locale === 'en' ? 'en-GB' : locale === 'pl' ? 'pl-PL' : 'uk-UA';
  return date.toLocaleDateString(loc, { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * `noindex, nofollow`: сторінка адресна (унікальний токен у QR на PDF) і не має
 * бути в пошуку. У robots.txt її свідомо НЕ блокуємо — інакше зламались би
 * прев'ю/сканери, які відкривають лінк із сертифіката.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    path: '/certificate',
    title: 'Верифікація сертифіката',
    description: 'Перевірка справжності сертифіката, виданого UIMP.',
    noindex: true,
  });
}

export default async function CertificateVerifyPage({ params }: Props) {
  const { locale, token } = await params;

  if (!token || token.length < 16) return notFound();

  const hdrs = await headers();
  const ip = clientIpFrom(hdrs.get('x-forwarded-for')) ?? hdrs.get('x-real-ip') ?? '127.0.0.1';

  /// Той самий ліміт, що й на API-роутах верифікації. Без нього сторінка була
  /// відкритим каналом для перебору токенів: кожен запит — повний lookup у БД, а
  /// нижче ще й рендер із PDF-preview.
  const rl = await checkRateLimitRaw('certVerify', ip);
  if (!rl.success) return <TooManyRequests retryAfter={rl.retryAfter} />;

  const cert = await prisma.certificate.findUnique({
    where: { verificationToken: token },
    include: {
      course: { select: { slug: true, title: true } },
    },
  });
  if (!cert) return notFound();

  /// Log VIEWED — не блокуємо рендер. Дедуплікація 1/год на (сертифікат, IP)
  /// всередині `logCertificateView`: сторінка ще тягне PDF-preview і API-роут, тож
  /// одне відкриття інакше давало б кілька однакових подій у журналі.
  void logCertificateView(cert.id, ip, hdrs.get('user-agent'));

  const typeLabel =
    cert.type === 'COURSE'
      ? 'Сертифікат про завершення курсу'
      : cert.type === 'SUPERVISION'
        ? 'Сертифікат супервізії'
        : 'Сертифікат Річної програми';
  const categoryLabel = cert.category === 'LISTENER'
    ? 'Слухач'
    : cert.category === 'PRACTICAL'
      ? 'Практична участь'
      : cert.category === 'PARTICIPANT'
        ? 'Учасник'
        : null;
  const courseTitle = cert.courseName ?? cert.course?.title ?? null;
  const subjectFieldLabel = cert.type === 'SUPERVISION' ? 'Тема супервізії' : 'Курс';
  const supervisionDateStr = cert.supervisionDate
    ? new Date(cert.supervisionDate).toLocaleDateString(
        locale === 'en' ? 'en-GB' : locale === 'pl' ? 'pl-PL' : 'uk-UA',
        { day: '2-digit', month: 'long', year: 'numeric' },
      )
    : null;
  const supervisionHoursStr = (() => {
    const h = cert.supervisionHours;
    if (h === null || h === undefined || !Number.isFinite(h) || h <= 0) return null;
    const rounded = Math.round(h * 10) / 10;
    const display = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
    if (!Number.isInteger(rounded)) return `${display} години`;
    const mod10 = rounded % 10;
    const mod100 = rounded % 100;
    if (mod10 === 1 && mod100 !== 11) return `${display} година`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${display} години`;
    return `${display} годин`;
  })();
  /// SUPERVISION не має посилання — це не продукт із сторінкою.
  const linkUrl =
    cert.type === 'COURSE' && cert.course?.slug
      ? `/${locale}/courses/${cert.course.slug}`
      : cert.type === 'YEARLY_PROGRAM'
        ? `/${locale}/yearly-program`
        : null;
  const linkLabel =
    cert.type === 'COURSE' ? 'Переглянути курс' : 'Переглянути Річну програму';

  const pdfUrl = `/api/certificate/${token}/pdf`;

  return (
    <main className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-amber-50/30 py-10 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-300/50 bg-gradient-to-br from-amber-50 to-white shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] tracking-[0.22em] font-semibold text-amber-800 uppercase">
              UIMP · Верифікований сертифікат
            </span>
          </div>
          <h1 className="mt-6 text-2xl sm:text-3xl font-medium text-stone-600 tracking-tight">
            {typeLabel}
          </h1>
          <div className="mt-3 flex items-center justify-center gap-3 sm:gap-4">
            <span className="h-px flex-1 max-w-[80px] sm:max-w-[120px] bg-gradient-to-r from-transparent to-amber-600/60" />
            <p
              className="text-4xl sm:text-5xl italic text-stone-900 leading-none"
              style={{ fontFamily: "'CormorantGaramond', Georgia, serif" }}
            >
              {cert.recipientName}
            </p>
            <span className="h-px flex-1 max-w-[80px] sm:max-w-[120px] bg-gradient-to-l from-transparent to-amber-600/60" />
          </div>
          {categoryLabel && (
            <p className="mt-3 text-[11px] font-semibold text-amber-700 uppercase tracking-[0.22em]">
              {categoryLabel}
            </p>
          )}
        </div>

        {cert.revoked && (
          <div className="mb-6 rounded-xl border border-red-300 bg-red-50 px-5 py-4 text-red-900">
            <div className="font-semibold">Сертифікат відкликано</div>
            {cert.revokedAt && (
              <div className="text-sm mt-0.5 text-red-700">
                Дата відклику: {formatDate(cert.revokedAt, locale)}
              </div>
            )}
            {cert.revokedReason && (
              <div className="text-sm mt-0.5 text-red-700">
                Причина: {cert.revokedReason}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          <CertificatePreview
            pdfUrl={pdfUrl}
            certNumber={cert.certNumber}
            fallbackUrl={pdfUrl}
          />

          <aside className="space-y-4">
            <div className="rounded-2xl border border-stone-200 bg-white/80 backdrop-blur p-5">
              <DetailRow label="Номер" value={cert.certNumber} mono />
              <DetailRow label="Видано" value={formatDate(cert.issuedAt, locale)} />
              <DetailRow label="Рік" value={String(cert.issueYear)} />
              {courseTitle && <DetailRow label={subjectFieldLabel} value={courseTitle} />}
              {supervisionDateStr && <DetailRow label="Дата супервізії" value={supervisionDateStr} />}
              {supervisionHoursStr && <DetailRow label="Тривалість" value={supervisionHoursStr} />}
              {categoryLabel && <DetailRow label="Категорія" value={categoryLabel} />}
            </div>

            <div className="flex flex-col gap-2.5">
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="block text-center px-4 py-3 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white font-semibold shadow-md hover:shadow-lg transition-shadow"
              >
                Відкрити PDF
              </a>
              <DownloadButton
                pdfUrl={pdfUrl}
                filename={certificateFilename(cert)}
              />

              {linkUrl && (
                <a
                  href={linkUrl}
                  className="block text-center px-4 py-3 rounded-xl border border-stone-300 bg-white text-stone-800 font-medium hover:bg-stone-50 transition-colors"
                >
                  {linkLabel}
                </a>
              )}
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-5 text-xs text-stone-600 leading-relaxed">
              <div className="font-semibold text-stone-800 mb-1">Як перевірити справжність?</div>
              <p>
                Ця сторінка доступна за унікальним посиланням (QR-код на сертифікаті). Якщо ви
                бачите верифікований статус — сертифікат справжній. Питання:
                {' '}
                <a href="mailto:edu@uimp.com.ua" className="text-amber-800 underline">edu@uimp.com.ua</a>
              </p>
            </div>
          </aside>
        </div>

        <footer className="mt-10 text-center text-xs text-stone-400">
          {appBaseUrl().replace(/^https?:\/\//, '')} · UIMP Institute
        </footer>
      </div>
    </main>
  );
}

/// Показується замість сертифіката, коли з цього IP прийшло забагато запитів.
/// Свідомо без деталей про сам сертифікат — щоб сторінка не підтверджувала
/// існування токена тому, хто їх перебирає.
function TooManyRequests({ retryAfter }: { retryAfter: number }) {
  const minutes = Math.max(1, Math.ceil(retryAfter / 60));
  return (
    <main className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-amber-50/30 py-10 px-4">
      <div className="max-w-lg mx-auto text-center pt-20">
        <h1 className="text-2xl font-medium text-stone-700">Забагато запитів</h1>
        <p className="mt-3 text-stone-600">
          Перевірку сертифікатів тимчасово обмежено. Спробуйте приблизно через {minutes} хв.
        </p>
        <p className="mt-6 text-sm text-stone-500">
          Питання:{' '}
          <a href="mailto:edu@uimp.com.ua" className="text-amber-800 underline">
            edu@uimp.com.ua
          </a>
        </p>
      </div>
    </main>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-stone-100 last:border-0">
      <span className="text-[11px] uppercase tracking-wider text-stone-500 font-medium">{label}</span>
      <span className={`text-sm text-stone-800 font-medium text-right ${mono ? 'font-mono tracking-wide' : ''}`}>
        {value}
      </span>
    </div>
  );
}
