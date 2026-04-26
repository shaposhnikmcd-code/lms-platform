/// POST /api/admin/certificates/[id]/revoke — відклик сертифіката. Зі списку не видаляється,
/// публічна верифікаційна сторінка показуватиме red banner.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/certificates/adminAuth';
import { revokeCertificate } from '@/lib/certificates/service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const reason = (body as { reason?: string })?.reason?.trim();
  try {
    await revokeCertificate(id, guard.actor, reason);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
