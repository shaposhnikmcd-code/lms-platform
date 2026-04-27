/// GET /api/certificate/[token]/pdf — публічний download PDF (no auth, rate-limited).
/// Відкликані сертифікати ВСЕ ОДНО віддаємо — але public сторінка покаже revoked banner.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkRateLimit } from '@/lib/ratelimit';
import { regeneratePdfBytes } from '@/lib/certificates/service';
import { certificateContentDisposition } from '@/lib/certificates/filename';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const rl = await checkRateLimit(req, 'certVerify');
  if (!rl.ok) return rl.response!;

  const { token } = await params;
  const cert = await prisma.certificate.findUnique({ where: { verificationToken: token } });
  if (!cert) return NextResponse.json({ error: 'Not found' }, { status: 404 });

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
      'Cache-Control': 'public, max-age=300',
    },
  });
}
