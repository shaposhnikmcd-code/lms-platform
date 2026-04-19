import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/adminAuth';
import {
  manualBeforeExpiry,
  manualOnExpiry,
  manualGraceStart,
  cyclicalChargeFailed1,
  cyclicalChargeFailed3,
  accessClosed,
} from '@/lib/emailTemplates/yearlyProgram';

/// Повертає HTML рендер email-шаблону для попереднього перегляду в адмінці.
/// ?type=manual-before | manual-on-expiry | manual-grace-start
///       cyclical-failed-1 | cyclical-failed-3
///       closed
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const type = req.nextUrl.searchParams.get('type') ?? 'manual-before';
  const sampleName = 'Ім\'я Прізвище';
  const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const gracePeriodEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  let html = '';
  switch (type) {
    case 'manual-before':
      html = manualBeforeExpiry({ name: sampleName, expiresAt: in3Days }).html;
      break;
    case 'manual-on-expiry':
      html = manualOnExpiry({ name: sampleName }).html;
      break;
    case 'manual-grace-start':
      html = manualGraceStart({ name: sampleName, gracePeriodEndsAt }).html;
      break;
    case 'cyclical-failed-1':
      html = cyclicalChargeFailed1({ name: sampleName, gracePeriodEndsAt }).html;
      break;
    case 'cyclical-failed-3':
      // Для 3-го дня залишок 4 дні
      html = cyclicalChargeFailed3({
        name: sampleName,
        gracePeriodEndsAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      }).html;
      break;
    case 'closed':
      html = accessClosed({ name: sampleName }).html;
      break;
    default:
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  }

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
