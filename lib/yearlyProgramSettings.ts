/// Singleton-конфіг сторінки `/yearly-program` (Річна програма), редагований
/// з адмінки. Зберігається у `YearlyProgramSetting` (id="singleton"). Якщо поле
/// = null → fallback на дефолт із цього файлу.
///
/// Дефолти мають збігатись з:
/// - `app/[locale]/yearly-program/config.ts` (price, monthlyPrice)
/// - `app/[locale]/yearly-program/_content/uk.ts` (btnLabel, priceNote, duration)

import type { PrismaClient } from '@prisma/client';

export const YEARLY_PROGRAM_SETTING_ID = 'singleton';

export const YEARLY_PROGRAM_DEFAULTS = {
  yearlyPrice: 15000,
  monthlyPrice: 2200,
  btnLabel: 'Реєстрація незабаром відкриється',
  priceNote: 'інформація оновлюється',
  duration: '9 місяців',
  registrationOpen: true,
} as const;

export interface YearlyProgramSettings {
  yearlyPrice: number;
  yearlyOldPrice: number | null;
  monthlyPrice: number;
  monthlyOldPrice: number | null;
  btnLabel: string;
  priceNote: string;
  duration: string;
  registrationOpen: boolean;
  /// Які поля overridден з адмінки (для UI плейсхолдерів дефолту).
  overrides: {
    yearlyPrice: boolean;
    monthlyPrice: boolean;
    btnLabel: boolean;
    priceNote: boolean;
    duration: boolean;
  };
}

type YearlyProgramSettingClient = Pick<PrismaClient, 'yearlyProgramSetting' | 'categoryPromoOverride'>;

/// Читає налаштування з БД і накладає дефолти. Безпечний у білд-таймі —
/// якщо таблиця ще не мігрована, повертає чисті дефолти.
///
/// Пріоритет ціни (вищий → нижчий):
///   1. `CategoryPromoOverride.price` (категорії "yearly"/"monthly") — редагується з `/dashboard/admin/courses`
///   2. `YearlyProgramSetting.{yearlyPrice,monthlyPrice}` — редагується зі сторінки керування Річною
///   3. `YEARLY_PROGRAM_DEFAULTS` — дефолти з коду
/// `oldPrice` (перекреслена) береться лише з CategoryPromoOverride.
export async function getYearlyProgramSettings(
  prismaClient: YearlyProgramSettingClient,
): Promise<YearlyProgramSettings> {
  let row: {
    yearlyPrice: number | null;
    monthlyPrice: number | null;
    btnLabel: string | null;
    priceNote: string | null;
    duration: string | null;
    registrationOpen: boolean;
  } | null = null;
  let categoryOverrides: Array<{ category: string; price: number | null; oldPrice: number | null }> = [];
  try {
    [row, categoryOverrides] = await Promise.all([
      prismaClient.yearlyProgramSetting.findUnique({ where: { id: YEARLY_PROGRAM_SETTING_ID } }),
      prismaClient.categoryPromoOverride.findMany({
        where: { category: { in: ['yearly', 'monthly'] } },
        select: { category: true, price: true, oldPrice: true },
      }),
    ]);
  } catch {
    row = null;
    categoryOverrides = [];
  }

  const byCategory = new Map(categoryOverrides.map((r) => [r.category, r]));
  const yearlyCat = byCategory.get('yearly');
  const monthlyCat = byCategory.get('monthly');

  const yearlyPrice = yearlyCat?.price ?? row?.yearlyPrice ?? YEARLY_PROGRAM_DEFAULTS.yearlyPrice;
  const monthlyPrice = monthlyCat?.price ?? row?.monthlyPrice ?? YEARLY_PROGRAM_DEFAULTS.monthlyPrice;

  return {
    yearlyPrice,
    yearlyOldPrice: yearlyCat?.oldPrice ?? null,
    monthlyPrice,
    monthlyOldPrice: monthlyCat?.oldPrice ?? null,
    btnLabel: row?.btnLabel ?? YEARLY_PROGRAM_DEFAULTS.btnLabel,
    priceNote: row?.priceNote ?? YEARLY_PROGRAM_DEFAULTS.priceNote,
    duration: row?.duration ?? YEARLY_PROGRAM_DEFAULTS.duration,
    registrationOpen: row?.registrationOpen ?? YEARLY_PROGRAM_DEFAULTS.registrationOpen,
    overrides: {
      yearlyPrice: row?.yearlyPrice != null || yearlyCat?.price != null,
      monthlyPrice: row?.monthlyPrice != null || monthlyCat?.price != null,
      btnLabel: row?.btnLabel != null,
      priceNote: row?.priceNote != null,
      duration: row?.duration != null,
    },
  };
}
