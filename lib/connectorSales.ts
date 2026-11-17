import prisma from "@/lib/prisma";

/// Стан продажу гри «Конектор» (singleton у `ConnectorSalesSetting`).
/// Відсутній рядок = продаж відкритий. Читається публічними сторінками /games і
/// /links/connector та `POST /api/connector`; пишеться з адмінки Конектора.

export const CONNECTOR_SALES_SINGLETON_ID = "singleton";
export const CONNECTOR_PAUSED_LABEL_DEFAULT = "Очікується поповнення";
export const CONNECTOR_PAUSED_LABEL_MAX = 60;
export const CONNECTOR_PAUSED_NOTE_MAX = 200;

export interface ConnectorSalesState {
  paused: boolean;
  /// Текст замість кнопки «Замовити». Завжди непорожній (дефолт підставлено).
  pausedLabel: string;
  /// Пояснення під кнопкою або null.
  pausedNote: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

const OPEN: ConnectorSalesState = {
  paused: false,
  pausedLabel: CONNECTOR_PAUSED_LABEL_DEFAULT,
  pausedNote: null,
  updatedBy: null,
  updatedAt: null,
};

function toState(row: {
  paused: boolean;
  pausedLabel: string | null;
  pausedNote: string | null;
  updatedBy: string | null;
  updatedAt: Date;
} | null): ConnectorSalesState {
  if (!row) return OPEN;
  return {
    paused: row.paused,
    pausedLabel: row.pausedLabel?.trim() || CONNECTOR_PAUSED_LABEL_DEFAULT,
    pausedNote: row.pausedNote?.trim() || null,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toISOString(),
  };
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

export async function setConnectorSalesState(
  input: { paused: boolean; pausedLabel: string | null; pausedNote: string | null },
  updatedBy: string | null,
): Promise<ConnectorSalesState> {
  const data = {
    paused: input.paused,
    pausedLabel: input.pausedLabel,
    pausedNote: input.pausedNote,
    updatedBy,
  };
  const row = await prisma.connectorSalesSetting.upsert({
    where: { id: CONNECTOR_SALES_SINGLETON_ID },
    create: { id: CONNECTOR_SALES_SINGLETON_ID, ...data },
    update: data,
  });
  return toState(row);
}
