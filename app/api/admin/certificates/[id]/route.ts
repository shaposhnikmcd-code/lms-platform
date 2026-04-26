/// GET /api/admin/certificates/[id] — деталі сертифіката + повний event log.

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
