/// GET /api/admin/certificates — список сертифікатів з фільтрами.
/// Query params:
///   - type: COURSE | YEARLY_PROGRAM (опційно)
///   - status: SENT | FAILED | PENDING (опційно)
///   - search: email / name / certNumber (опційно)
///   - limit: default 200

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/certificates/adminAuth';
import type { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const sp = req.nextUrl.searchParams;
  const type = sp.get('type');
  const status = sp.get('status');
  const search = sp.get('search')?.trim();
  const limit = Math.min(Number(sp.get('limit')) || 200, 500);

  const where: Prisma.CertificateWhereInput = {};
  if (type === 'COURSE' || type === 'YEARLY_PROGRAM') where.type = type;
  if (status === 'SENT' || status === 'FAILED' || status === 'PENDING' || status === 'BOUNCED') {
    where.emailStatus = status;
  }
  if (search) {
    where.OR = [
      { recipientEmail: { contains: search, mode: 'insensitive' } },
      { recipientName: { contains: search, mode: 'insensitive' } },
      { certNumber: { contains: search, mode: 'insensitive' } },
    ];
  }

  const certificates = await prisma.certificate.findMany({
    where,
    orderBy: { issuedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      certNumber: true,
      verificationToken: true,
      type: true,
      category: true,
      recipientName: true,
      recipientEmail: true,
      courseName: true,
      issueYear: true,
      issuedAt: true,
      issuedManually: true,
      issuedByName: true,
      issuedByEmail: true,
      emailStatus: true,
      emailSentAt: true,
      emailError: true,
      revoked: true,
      revokedAt: true,
      revokedByName: true,
      revokedReason: true,
      courseId: true,
      subscriptionId: true,
    },
  });

  return NextResponse.json({ certificates });
}
