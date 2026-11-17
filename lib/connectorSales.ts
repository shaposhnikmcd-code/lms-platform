import prisma from "@/lib/prisma";

/// Стан продажу гри «Конектор» (singleton у `ConnectorSalesSetting`).
/// Відсутній рядок = продаж відкритий. Читається публічними сторінками /games і
/// /links/connector та `POST /api/connector`; пишеться з адмінки Конектора.
/// Тексти — окремо на кожну мову сайту: кнопка має дефолт для кожної мови,
/// пояснення під кнопкою показується лише якщо заповнене для ЦІЄЇ мови
/// (українське англомовному клієнту не підставляється).

export const CONNECTOR_SALES_SINGLETON_ID = "singleton";
export const CONNECTOR_SALES_LOCALES = ["uk", "en", "pl"] as const;
export type ConnectorSalesLocale = (typeof CONNECTOR_SALES_LOCALES)[number];

export const CONNECTOR_PAUSED_LABEL_DEFAULT: Record<ConnectorSalesLocale, string> = {
  uk: "Очікується поповнення",
  en: "Temporarily out of stock",
  pl: "Chwilowo niedostępne",
};
export const CONNECTOR_PAUSED_LABEL_MAX = 60;
export const CONNECTOR_PAUSED_NOTE_MAX = 200;

export interface ConnectorSalesTexts {
  /// Текст замість кнопки «Замовити». Завжди непорожній (дефолт підставлено).
  label: string;
  /// Пояснення під кнопкою або null.
  note: string | null;
}

export interface ConnectorSalesState {
  paused: boolean;
  texts: Record<ConnectorSalesLocale, ConnectorSalesTexts>;
  updatedBy: string | null;
  updatedAt: string | null;
}

/// Те, що бачить одна мовна версія сторінки.
export interface ConnectorSalesForLocale extends ConnectorSalesTexts {
  paused: boolean;
}

export type ConnectorSalesInput = {
  paused: boolean;
  texts: Record<ConnectorSalesLocale, { label: string | null; note: string | null }>;
};

const OPEN: ConnectorSalesState = {
  paused: false,
  texts: {
    uk: { label: CONNECTOR_PAUSED_LABEL_DEFAULT.uk, note: null },
    en: { label: CONNECTOR_PAUSED_LABEL_DEFAULT.en, note: null },
    pl: { label: CONNECTOR_PAUSED_LABEL_DEFAULT.pl, note: null },
  },
  updatedBy: null,
  updatedAt: null,
};

type Row = {
  paused: boolean;
  pausedLabel: string | null;
  pausedNote: string | null;
  pausedLabelEn: string | null;
  pausedNoteEn: string | null;
  pausedLabelPl: string | null;
  pausedNotePl: string | null;
  updatedBy: string | null;
  updatedAt: Date;
};

function texts(locale: ConnectorSalesLocale, label: string | null, note: string | null): ConnectorSalesTexts {
  return {
    label: label?.trim() || CONNECTOR_PAUSED_LABEL_DEFAULT[locale],
    note: note?.trim() || null,
  };
}

function toState(row: Row | null): ConnectorSalesState {
  if (!row) return OPEN;
  return {
    paused: row.paused,
    texts: {
      uk: texts("uk", row.pausedLabel, row.pausedNote),
      en: texts("en", row.pausedLabelEn, row.pausedNoteEn),
      pl: texts("pl", row.pausedLabelPl, row.pausedNotePl),
    },
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function connectorSalesForLocale(state: ConnectorSalesState, locale: string): ConnectorSalesForLocale {
  const loc: ConnectorSalesLocale = (CONNECTOR_SALES_LOCALES as readonly string[]).includes(locale)
    ? (locale as ConnectorSalesLocale)
    : "uk";
  return { paused: state.paused, ...state.texts[loc] };
}

/// Fail-open: якщо БД недоступна — продаж вважається відкритим (як і ціна в
/// `getConnectorPricing`), щоб збій таблиці налаштувань не ховав кнопку.
export async function getConnectorSalesState(): Promise<ConnectorSalesState> {
  try {
    const row = await prisma.connectorSalesSetting.findUnique({
      where: { id: CONNECTOR_SALES_SINGLETON_ID },
    });
    return toState(row);
  } catch {
    return OPEN;
  }
}

export async function setConnectorSalesState(input: ConnectorSalesInput, updatedBy: string | null): Promise<ConnectorSalesState> {
  const data = {
    paused: input.paused,
    pausedLabel: input.texts.uk.label,
    pausedNote: input.texts.uk.note,
    pausedLabelEn: input.texts.en.label,
    pausedNoteEn: input.texts.en.note,
    pausedLabelPl: input.texts.pl.label,
    pausedNotePl: input.texts.pl.note,
    updatedBy,
  };
  const row = await prisma.connectorSalesSetting.upsert({
    where: { id: CONNECTOR_SALES_SINGLETON_ID },
    create: { id: CONNECTOR_SALES_SINGLETON_ID, ...data },
    update: data,
  });
  return toState(row);
}
