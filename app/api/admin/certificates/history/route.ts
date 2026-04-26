/// GET /api/admin/certificates/history — event log across всіх certs (для вкладки "Історія").

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/certificates/adminAuth';
import type { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const sp = req.nextUrl.searchParams;
  const action = sp.get('action');
  const actorId = sp.get('actorId');
  const limit = Math.min(Number(sp.get('limit')) || 300, 1000);

  const where: Prisma.CertificateEventWhereInput = {};
  if (action) where.action = action;
  if (actorId) where.actorId = actorId;

  const events = await prisma.certificateEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      certificate: {
        select: {
          id: true,
          certNumber: true,
          type: true,
          category: true,
          recipientName: true,
          recipientEmail: true,
          courseName: true,
          revoked: true,
        },
      },
    },
  });

  return NextResponse.json({ events });
}
