/// GET /api/admin/certificates/preview?type=...&category=...&name=...&courseName=...&year=...
/// Генерує PDF-сертифікат за query params БЕЗ запису у БД. Використовується
/// admin-діалогами "Видати" для попереднього перегляду до клацання "Видати і відправити".
/// GET (а не POST) щоб iframe міг напряму використовувати src без blob-URL —
/// деякі браузери блокують blob URL в iframe через CSP/sandbox.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/certificates/adminAuth';
import { generateCertificatePdf } from '@/lib/certificates/generatePdf';
import { appBaseUrl } from '@/lib/mailer';
import type { TemplateKey } from '@/lib/certificates/templateConfig';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const sp = req.nextUrl.searchParams;
  const type = sp.get('type') as 'COURSE' | 'YEARLY_PROGRAM' | null;
  const category = sp.get('category') as 'LISTENER' | 'PRACTICAL' | null;
  const recipientName = sp.get('name')?.trim();
  const courseName = sp.get('courseName')?.trim();
  const yearRaw = sp.get('year');

  if (!type || !recipientName) {
    return NextResponse.json({ error: 'type + name обовязкові' }, { status: 400 });
  }

  let templateKey: TemplateKey;
  if (type === 'COURSE') templateKey = 'COURSE';
  else templateKey = category === 'LISTENER' ? 'YEARLY_LISTENER' : 'YEARLY_PRACTICAL';

  const year = yearRaw ? parseInt(yearRaw, 10) : new Date().getUTCFullYear();
  const pdfBytes = await generateCertificatePdf({
    templateKey,
    recipientName,
    issueYear: Number.isFinite(year) ? year : new Date().getUTCFullYear(),
    certNumber: 'UIMP-PREVIEW-0000',
    verificationUrl: `${appBaseUrl()}/uk/certificate/preview`,
    courseName,
    category: category ?? undefined,
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="certificate-preview.pdf"',
      'Cache-Control': 'private, no-store',
    },
  });
}
