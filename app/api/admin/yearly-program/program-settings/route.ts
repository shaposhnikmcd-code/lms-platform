import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin } from '@/lib/adminAuth';
import { revalidateLocalized } from '@/lib/revalidatePaths';
import {
  YEARLY_PROGRAM_DEFAULTS,
  YEARLY_PROGRAM_SETTING_ID,
  getYearlyProgramSettings,
} from '@/lib/yearlyProgramSettings';

/// GET — повертає поточні налаштування + дефолти для UI плейсхолдерів.
/// PATCH — upsert. Body: { yearlyPrice?, monthlyPrice?, btnLabel?, priceNote?, duration?, registrationOpen? }.
///   Порожній рядок або null у text-полях → reset до дефолту (поле = null у БД).
///   0 / negative у price-полях → reset до дефолту.
/// DELETE — видаляє рядок (повний reset до дефолтів з коду).

const MIN_PRICE = 1;
const MAX_PRICE = 1_000_000;

function normalizeText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizePrice(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(num) || num < MIN_PRICE || num > MAX_PRICE) return undefined;
  return num;
}

function revalidateYearlyProgram() {
  revalidateLocalized('/yearly-program');
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const settings = await getYearlyProgramSettings(prisma);
  return NextResponse.json({
    settings,
    defaults: YEARLY_PROGRAM_DEFAULTS,
  });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  const yp = normalizePrice(body.yearlyPrice);
  const mp = normalizePrice(body.monthlyPrice);
  const bl = normalizeText(body.btnLabel);
  const pn = normalizeText(body.priceNote);
  const dur = normalizeText(body.duration);
  if (yp !== undefined) data.yearlyPrice = yp;
  if (mp !== undefined) data.monthlyPrice = mp;
  if (bl !== undefined) data.btnLabel = bl;
  if (pn !== undefined) data.priceNote = pn;
  if (dur !== undefined) data.duration = dur;
  if (typeof body.registrationOpen === 'boolean') data.registrationOpen = body.registrationOpen;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Немає змін' }, { status: 400 });
  }

  await prisma.yearlyProgramSetting.upsert({
    where: { id: YEARLY_PROGRAM_SETTING_ID },
    create: {
      id: YEARLY_PROGRAM_SETTING_ID,
      yearlyPrice: (data.yearlyPrice as number | null | undefined) ?? null,
      monthlyPrice: (data.monthlyPrice as number | null | undefined) ?? null,
      btnLabel: (data.btnLabel as string | null | undefined) ?? null,
      priceNote: (data.priceNote as string | null | undefined) ?? null,
      duration: (data.duration as string | null | undefined) ?? null,
      registrationOpen:
        (data.registrationOpen as boolean | undefined) ?? YEARLY_PROGRAM_DEFAULTS.registrationOpen,
    },
    update: data,
  });

  revalidateYearlyProgram();
  const settings = await getYearlyProgramSettings(prisma);
  return NextResponse.json({ settings });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await prisma.yearlyProgramSetting.deleteMany({ where: { id: YEARLY_PROGRAM_SETTING_ID } });
  revalidateYearlyProgram();
  const settings = await getYearlyProgramSettings(prisma);
  return NextResponse.json({ settings });
}
