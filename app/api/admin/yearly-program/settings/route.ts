import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin } from '@/lib/adminAuth';
import {
  YEARLY_GRACE_SETTING_KEY,
  YEARLY_GRACE_MIN_DAYS,
  YEARLY_GRACE_MAX_DAYS,
  YEARLY_PROGRAM_CONFIG,
  getYearlyGraceDays,
} from '@/lib/yearlyProgramConfig';

/// GET — повертає поточні налаштування Річної програми (grace-період).
/// PATCH — оновлює graceDays. Body: { graceDays: number }.
/// Впливає тільки на нові переходи ACTIVE→GRACE у cron. Існуючі GRACE-підписки
/// не перераховуються — у них `gracePeriodEndsAt` вже зафіксовано.

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const graceDays = await getYearlyGraceDays(prisma);
  return NextResponse.json({
    graceDays,
    defaultGraceDays: YEARLY_PROGRAM_CONFIG.graceDays,
    minGraceDays: YEARLY_GRACE_MIN_DAYS,
    maxGraceDays: YEARLY_GRACE_MAX_DAYS,
  });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { graceDays?: unknown };
  const raw = body.graceDays;
  const value = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(value) || value < YEARLY_GRACE_MIN_DAYS || value > YEARLY_GRACE_MAX_DAYS) {
    return NextResponse.json(
      { error: `graceDays має бути цілим числом від ${YEARLY_GRACE_MIN_DAYS} до ${YEARLY_GRACE_MAX_DAYS}` },
      { status: 400 },
    );
  }
  await prisma.appSetting.upsert({
    where: { key: YEARLY_GRACE_SETTING_KEY },
    create: { key: YEARLY_GRACE_SETTING_KEY, value },
    update: { value },
  });
  return NextResponse.json({ graceDays: value });
}
