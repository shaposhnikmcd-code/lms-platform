/// Публічна сторінка верифікації сертифіката. Доступна всім (no auth).
/// QR-код з PDF веде сюди. Показує:
///   - Вбудований PDF-preview
///   - Ім'я получателя, номер, дата, тип (курс/річна), категорія
///   - "UIMP — Verified" badge
///   - Якщо revoked: червоний банер
///   - Посилання на курс або Річну програму

import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { appBaseUrl } from '@/lib/mailer';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string; token: string }>;
};

function formatDate(d: Date | string, locale: string): string {
  const date = new Date(d);
  const loc = locale === 'en' ? 'en-GB' : locale === 'pl' ? 'pl-PL' : 'uk-UA';
  return date.toLocaleDateString(loc, { day: '2-digit', month: 'long', year: 'numeric' });
}

export default async function CertificateVerifyPage({ params }: Props) {
  const { locale, token } = await params;

  if (!token || token.length < 16) return notFound();

  const cert = await prisma.certificate.findUnique({
    where: { verificationToken: token },
    include: {
      course: { select: { slug: true, title: true } },
    },
  });
  if (!cert) return notFound();

  /// Log VIEWED — не блокуємо рендер.
  const hdrs = await headers();
  prisma.certificateEvent
    .create({
      data: {
        certificateId: cert.id,
        action: 'VIEWED',
        metadata: {
          ip: hdrs.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
          ua: hdrs.get('user-agent') ?? null,
        } as object,
      },
    })
    .catch(() => {});

  const typeLabel = cert.type === 'COURSE'
    ? 'Сертифікат про завершення курсу'
    : 'Сертифікат Річної програми';
  const categoryLabel = cert.category === 'LISTENER'
    ? 'Слухач'
    : cert.category === 'PRACTICAL'
      ? 'Практична участь'
      : null;
  const courseTitle = cert.courseName ?? cert.course?.title ?? null;
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
          <h1 className="mt-6 text-3xl sm:text-4xl font-semibold text-stone-900 tracking-tight">
            {typeLabel}
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            {cert.recipientName}
            {categoryLabel ? ` — ${categoryLabel}` : ''}
          </p>
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
          <div className="rounded-2xl border border-stone-200 bg-white shadow-md overflow-hidden">
            <object
              data={pdfUrl}
              type="application/pdf"
              className="w-full h-[640px] block"
            >
              <div className="p-8 text-center">
                <p className="text-stone-600 mb-4">
                  Ваш браузер не підтримує попередній перегляд PDF.
                </p>
                <a
                  href={pdfUrl}
                  className="inline-block px-5 py-2.5 rounded-lg bg-amber-600 text-white font-medium"
                >
                  Завантажити PDF
                </a>
              </div>
            </object>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-stone-200 bg-white/80 backdrop-blur p-5">
              <DetailRow label="Номер" value={cert.certNumber} mono />
              <DetailRow label="Видано" value={formatDate(cert.issuedAt, locale)} />
              <DetailRow label="Рік" value={String(cert.issueYear)} />
              {courseTitle && <DetailRow label="Курс" value={courseTitle} />}
              {categoryLabel && <DetailRow label="Категорія" value={categoryLabel} />}
            </div>

            <div className="flex flex-col gap-2.5">
              <a
                href={pdfUrl}
                className="block text-center px-4 py-3 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white font-semibold shadow-md hover:shadow-lg transition-shadow"
              >
                Завантажити PDF
              </a>
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
