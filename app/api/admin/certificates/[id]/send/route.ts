/// POST /api/admin/certificates/[id]/send — перша відправка листа з PDF для сертифіката,
/// виданого без листа (emailStatus = PENDING) або коли перша спроба впала (FAILED).
/// Повторна відправка вже надісланого листа — окремий endpoint `/resend`.
///
/// Приймаються обидва «ще не доставлені» стани — PENDING і FAILED (єдина заборона в
/// `sendCertificateFirstEmail` — SENT і revoked). Тому кнопка «Надіслати листом» у
/// таблиці показується і для рядків із помилкою відправки.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/certificates/adminAuth';
import { sendCertificateFirstEmail } from '@/lib/certificates/service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  const { id } = await params;
  try {
    await sendCertificateFirstEmail(id, guard.actor);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
