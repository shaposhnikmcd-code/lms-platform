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
  const type = sp.get('type') as 'COURSE' | 'YEARLY_PROGRAM' | 'SUPERVISION' | null;
  const category = sp.get('category') as 'LISTENER' | 'PRACTICAL' | null;
  const recipientName = sp.get('name')?.trim();
  const courseName = sp.get('courseName')?.trim();
  const supervisionDate = sp.get('supervisionDate')?.trim();
  const yearRaw = sp.get('year');

  if (!type || !recipientName) {
    return NextResponse.json({ error: 'type + name обовязкові' }, { status: 400 });
  }

  let templateKey: TemplateKey;
  if (type === 'COURSE') templateKey = 'COURSE';
  else if (type === 'SUPERVISION') templateKey = 'SUPERVISION';
  else templateKey = category === 'LISTENER' ? 'YEARLY_LISTENER' : 'YEARLY_PRACTICAL';

  /// SUPERVISION: дату приймаємо як yyyy-mm-dd і форматуємо у «12 травня 2026 року»
  /// (та сама формула, що у lib/certificates/service.ts → formatSupervisionDate).
  /// Якщо невалідна — пропускаємо без помилки (превью не блокує форму).
  let supervisionDateFmt: string | undefined;
  if (type === 'SUPERVISION' && supervisionDate) {
    const d = new Date(supervisionDate);
    if (!Number.isNaN(d.getTime())) {
      const formatted = d.toLocaleDateString('uk-UA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      supervisionDateFmt = formatted.replace(/\s*р\.?$/, '').trim() + ' року';
    }
  }

  const year = yearRaw ? parseInt(yearRaw, 10) : new Date().getUTCFullYear();
  const pdfBytes = await generateCertificatePdf({
    templateKey,
    recipientName,
    issueYear: Number.isFinite(year) ? year : new Date().getUTCFullYear(),
    certNumber: 'UIMP-PREVIEW-0000',
    verificationUrl: `${appBaseUrl()}/uk/certificate/preview`,
    courseName,
    category: category ?? undefined,
    supervisionDate: supervisionDateFmt,
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
