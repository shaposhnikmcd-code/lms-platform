import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin } from '@/lib/adminAuth';
import { getYearlyGraceDays } from '@/lib/yearlyProgramConfig';
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
  // Беремо актуальне значення graceDays з налаштувань — щоб прев'ю точно матчилося з тим,
  // що отримає реальний студент (дати + словесні «N днів» рахуються від цього числа).
  const graceDays = await getYearlyGraceDays(prisma);
  const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const gracePeriodEndsAt = new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000);

  let html = '';
  switch (type) {
    case 'manual-before':
      html = (await manualBeforeExpiry({ name: sampleName, expiresAt: in3Days })).html;
      break;
    case 'manual-on-expiry':
      html = (await manualOnExpiry({ name: sampleName })).html;
      break;
    case 'manual-grace-start':
      html = (await manualGraceStart({ name: sampleName, gracePeriodEndsAt, graceDays })).html;
      break;
    case 'cyclical-failed-1':
      html = (await cyclicalChargeFailed1({ name: sampleName, gracePeriodEndsAt, graceDays })).html;
      break;
    case 'cyclical-failed-3':
      // Для 3-го дня залишок 4 дні
      html = (await cyclicalChargeFailed3({
        name: sampleName,
        gracePeriodEndsAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        graceDays,
      })).html;
      break;
    case 'closed':
      html = (await accessClosed({ name: sampleName })).html;
      break;
    default:
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  }

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
