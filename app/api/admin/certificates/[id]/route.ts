/// GET /api/admin/certificates/[id] — деталі сертифіката + повний event log.
/// DELETE /api/admin/certificates/[id] — hard-delete для тестування (тільки dev).

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/certificates/adminAuth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const cert = await prisma.certificate.findUnique({
    where: { id },
    include: {
      events: { orderBy: { createdAt: 'desc' } },
      user: { select: { id: true, name: true, email: true } },
      course: { select: { id: true, title: true, slug: true } },
      subscription: { select: { id: true, plan: true, status: true, expiresAt: true } },
    },
  });
  if (!cert) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ certificate: cert });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Hard delete заборонено в production. Використовуй revoke.' }, { status: 403 });
  }
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  try {
    await prisma.certificate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
