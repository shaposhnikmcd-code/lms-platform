/// POST /api/admin/certificates/[id]/resend — перевідправити лист з PDF.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/certificates/adminAuth';
import { resendCertificate } from '@/lib/certificates/service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  const { id } = await params;
  try {
    await resendCertificate(id, guard.actor);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
