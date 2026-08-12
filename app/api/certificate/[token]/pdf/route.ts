/// GET /api/certificate/[token]/pdf — публічний download PDF (no auth, rate-limited).
///
/// Відкликаний сертифікат PDF-ом більше не віддається: раніше файл лишався доступним
/// за прямим посиланням, і людина зі старим лінком не бачила жодної ознаки відклику.
/// Тепер — 410 Gone + перекидання на сторінку верифікації, де є червоний банер.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkRateLimit } from '@/lib/ratelimit';
import { regeneratePdfBytes, verificationUrl } from '@/lib/certificates/service';
import { certificateContentDisposition } from '@/lib/certificates/filename';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const rl = await checkRateLimit(req, 'certVerify');
  if (!rl.ok) return rl.response!;

  const { token } = await params;
  const cert = await prisma.certificate.findUnique({ where: { verificationToken: token } });
  if (!cert) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (cert.revoked) {
    /// 410 (а не 302): статус має лишитись «ресурсу більше немає» для будь-якого
    /// клієнта, який читає код відповіді. Браузеру достатньо meta-refresh, щоб
    /// людина опинилась на сторінці верифікації з поясненням.
    const target = verificationUrl(cert.verificationToken);
    const html = `<!doctype html><html lang="uk"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=${target}">
<title>Сертифікат відкликано</title></head>
<body style="font-family:system-ui,sans-serif;padding:40px;text-align:center">
<h1 style="font-size:20px">Сертифікат відкликано</h1>
<p>Файл більше не видається. <a href="${target}">Перейти на сторінку перевірки</a>.</p>
</body></html>`;
    return new NextResponse(html, {
      status: 410,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        Location: target,
        /// Відкликаний статус не можна кешувати ні в CDN, ні в браузері —
        /// інакше повторний відклик «не долітав» би до тих, хто вже відкривав PDF.
        'Cache-Control': 'private, no-store, must-revalidate',
      },
    });
  }

  const bytes = await regeneratePdfBytes(cert);

  // `?download=1` — форсує завантаження (Content-Disposition: attachment),
  // інакше PDF відкривається в браузерному вьюері (inline).
  const forceDownload = req.nextUrl.searchParams.get('download') === '1';

  prisma.certificateEvent
    .create({
      data: {
        certificateId: cert.id,
        action: 'DOWNLOADED',
        metadata: {
          ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
          mode: forceDownload ? 'attachment' : 'inline',
        } as object,
      },
    })
    .catch(() => {});

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': certificateContentDisposition(
        cert,
        forceDownload ? 'attachment' : 'inline',
      ),
      /// Кожна віддача = ~1.4 с генерації і ~3 МБ трафіку, а вміст PDF детермінований
      /// (усе з snapshot-полів). Тому кладемо на CDN на годину: перегляд сторінки
      /// верифікації з вбудованим preview перестає щоразу коштувати генерацію.
      /// Компроміс: після відклику CDN може ще до години віддавати старий файл.
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
