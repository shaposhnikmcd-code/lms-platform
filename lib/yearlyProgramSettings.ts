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
  monthlyPrice: number;
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

type YearlyProgramSettingClient = Pick<PrismaClient, 'yearlyProgramSetting'>;

/// Читає налаштування з БД і накладає дефолти. Безпечний у білд-таймі —
/// якщо таблиця ще не мігрована, повертає чисті дефолти.
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
  try {
    row = await prismaClient.yearlyProgramSetting.findUnique({
      where: { id: YEARLY_PROGRAM_SETTING_ID },
    });
  } catch {
    row = null;
  }

  return {
    yearlyPrice: row?.yearlyPrice ?? YEARLY_PROGRAM_DEFAULTS.yearlyPrice,
    monthlyPrice: row?.monthlyPrice ?? YEARLY_PROGRAM_DEFAULTS.monthlyPrice,
    btnLabel: row?.btnLabel ?? YEARLY_PROGRAM_DEFAULTS.btnLabel,
    priceNote: row?.priceNote ?? YEARLY_PROGRAM_DEFAULTS.priceNote,
    duration: row?.duration ?? YEARLY_PROGRAM_DEFAULTS.duration,
    registrationOpen: row?.registrationOpen ?? YEARLY_PROGRAM_DEFAULTS.registrationOpen,
    overrides: {
      yearlyPrice: row?.yearlyPrice != null,
      monthlyPrice: row?.monthlyPrice != null,
      btnLabel: row?.btnLabel != null,
      priceNote: row?.priceNote != null,
      duration: row?.duration != null,
    },
  };
}
