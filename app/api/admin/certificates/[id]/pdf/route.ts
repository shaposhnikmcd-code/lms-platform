/// GET /api/admin/certificates/[id]/pdf — admin-preview/download PDF. Регенерується on-demand
/// зі snapshot-полів. Response як `application/pdf` inline.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/certificates/adminAuth';
import { regeneratePdfBytes } from '@/lib/certificates/service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const cert = await prisma.certificate.findUnique({ where: { id } });
  if (!cert) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const bytes = await regeneratePdfBytes(cert);
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="certificate-${cert.certNumber}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
