import type { AutopayGraceReason } from './yearlyProgramReminderSchedule';
import type { RenewBlockReason } from './yearlyProgramRenewState';

/// Тексти панелі поновлення («Оплата наступного модуля») — адаптер над `messages/*.json`
/// (простір `RenewPanel`), окремо від React-компонента.
///
/// Навіщо окремий модуль: панель НЕ має права рендерити порожнечу. Людина приходить сюди
/// за посиланням з листа про гроші; порожній екран вона читає як поламаний сайт і пише
/// менеджеру. Реєстр `Record<RenewBlockReason, true>` робить це вимогою компілятора: додав
/// новий стан у `RenewState` — TypeScript не збереться, поки не вписав його сюди, а тест
/// `yearlyProgramRenewState.test.ts` перевіряє, що в КОЖНІЙ локалі (uk/en/pl) для нього є
/// заголовок, пояснення і рядок з менеджером.
///
/// Кожен запис — три частини: заголовок (що сталось), пояснення (чому і що це значить)
/// і префікс рядка з контактом менеджера, який дописує саме посилання.

export interface RenewCopy {
  title: string;
  body: string;
  /// Речення ПЕРЕД посиланням «напишіть менеджеру» — рядок закінчується ним.
  support: string;
  /// Підпис кнопки-переходу до робочого шляху оплати (лише для мертвого посилання).
  action?: string;
}

/// Перекладач простору `RenewPanel` — `useTranslations('RenewPanel')` на сторінці або
/// `createTranslator` у тестах.
export type RenewTranslator = (key: string, values?: Record<string, number>) => string;

/// Тексти блокувань дзеркалять 409-і з `/api/wayforpay`: сенс той самий, слова людські.
/// Сторінка не має права бути оптимістичнішою за платіжку.
///
/// Тексту про закриту реєстрацію тут свідомо немає: закриті продажі доплату модуля
/// чинним студентом не блокують (рішення власника 09.09.2026) — див. `resolveRenewState`.
const BLOCK_REASONS: Record<RenewBlockReason, true> = {
  autopay: true,
  yearly_active: true,
  fully_paid: true,
  debt: true,
  no_schedule: true,
  cohort_finished: true,
  no_payment: true,
  archived: true,
};

export function renewBlockCopy(t: RenewTranslator, reason: RenewBlockReason, missedModules = 0): RenewCopy {
  return {
    title: t(`blocks.${reason}.title`),
    // `missed` потрібен лише тексту боргу (ICU plural); решта ключів його ігнорує.
    body: t(`blocks.${reason}.body`, { missed: missedModules }),
    support: t(`blocks.${reason}.support`),
  };
}

/// Мертве посилання (прострочений/зіпсований токен або стан `invalid`).
export function renewDeadLinkCopy(t: RenewTranslator): RenewCopy {
  return {
    title: t('dead.title'),
    body: t('dead.body'),
    action: t('dead.action'),
    support: t('dead.support'),
  };
}

/// Пояснення над кнопкою оплати для автоплатника, у якого автосписання не спрацювало.
/// Текст залежить від причини: «не пройшло» чесне лише для відмови банку.
export function renewStopsAutopayCopy(t: RenewTranslator, reason: AutopayGraceReason): string {
  return t(`stopsAutopay.${reason}`);
}

const STOPS_AUTOPAY_REASONS: Record<AutopayGraceReason, true> = {
  charge_failed: true,
  no_rule: true,
  not_charged: true,
};
export const RENEW_STOPS_AUTOPAY_REASONS = Object.keys(STOPS_AUTOPAY_REASONS) as AutopayGraceReason[];

/// Усі стани блокування — для тестів і для перебору. Ключі `Record` вище повні за типом.
export const RENEW_BLOCK_REASONS = Object.keys(BLOCK_REASONS) as RenewBlockReason[];
