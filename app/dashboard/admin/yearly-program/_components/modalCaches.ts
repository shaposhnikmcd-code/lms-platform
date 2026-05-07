'use client';

/// Module-level кеші для важких модалок Річної програми. Винесено в окремий файл щоб
/// SSR-prewarm міг писати у кеш, а модалки code-split-итись через next/dynamic — без
/// тимчасової «гонки» між prewarm та lazy-завантаженням модалки.
///
/// Архітектурно:
///   - SSR (page.tsx → buildYearlyProgramAdminPrewarm) збирає дані server-side.
///   - YearlyProgramView mount → синхронно записує у кеші тут.
///   - Модалки (Payment/Reminder/SendEmails) читають кеші при open і стартують без skeleton-у.

// ─── TEMPLATES (PaymentTemplatesModal + RemindersTemplatesModal) ──────────────

export interface CachedTemplateListItem {
  key: string;
  group: string;
  title: string;
  when: string;
  placeholders: string[];
  sampleData: Record<string, string>;
  /// Мінімальна тривалість grace, при якій cron шле цей шаблон (тільки для reminder-шаблонів).
  /// null/undefined = шаблон активний завжди.
  minGraceDays?: number | null;
  isCustomized: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface CachedTemplateGroup {
  id: string;
  title: string;
  description: string;
}

export interface CachedTemplateList {
  items: CachedTemplateListItem[];
  groups: CachedTemplateGroup[];
  /// Поточне значення graceDays із налаштувань — використовується щоб у списку шаблонів
  /// показати, які mid/last-листи активні при поточній тривалості grace, а які пропускаються.
  /// Тільки для reminder-варіанта; для payment-варіанта — null.
  currentGraceDays?: number | null;
}

/// Повний шаблон — list-item + body fields. Кешується per-key per-modal-variant.
export type CachedTemplateFull = CachedTemplateListItem & {
  subject: string;
  bodyHtml: string;
  bodyInnerHtml: string;
  defaultSubject: string;
  defaultBodyHtml: string;
  defaultBodyInnerHtml: string;
};

const templateListCaches = new Map<string, CachedTemplateList>();
const templateFullCaches = new Map<string, Record<string, CachedTemplateFull>>();

export function getTemplateListCache(key: string): CachedTemplateList | undefined {
  return templateListCaches.get(key);
}

export function setTemplateListCache(key: string, payload: CachedTemplateList): void {
  templateListCaches.set(key, payload);
}

export function hasTemplateListCache(key: string): boolean {
  return templateListCaches.has(key);
}

export function getTemplateFullCache(key: string): Record<string, CachedTemplateFull> {
  let cache = templateFullCaches.get(key);
  if (!cache) { cache = {}; templateFullCaches.set(key, cache); }
  return cache;
}

/// SSR-prewarm: викликається з YearlyProgramView mount. НЕ перезаписує існуючий кеш —
/// зміни менеджера (save/reset) лишаються у кеші до повного refresh-у сторінки.
export function prewarmTemplateListCache(
  key: 'payment' | 'reminder',
  payload: CachedTemplateList,
): void {
  if (templateListCaches.has(key)) return;
  templateListCaches.set(key, payload);
}

/// Селективний sync: оновлює тільки `currentGraceDays` у reminder-кеші, не чіпаючи
/// items/groups (бо там можуть бути зміни isCustomized після save/reset). Викликається
/// при кожному re-render після router.refresh() з GraceSettingsModal — щоб індикатори
/// активності у списку шаблонів одразу відображали нове значення graceDays.
export function syncReminderListGraceDays(currentGraceDays: number | null): void {
  const cached = templateListCaches.get('reminder');
  if (!cached) return;
  if (cached.currentGraceDays === currentGraceDays) return;
  templateListCaches.set('reminder', { ...cached, currentGraceDays });
}

// ─── RECIPIENTS (SendEmailsModal) ──────────────

export interface CachedRecipient {
  subscriptionId: string;
  name: string | null;
  email: string;
  alreadySent: boolean;
  sentAt: string | null;
  hasPaidPayment: boolean;
  plan: 'YEARLY' | 'MONTHLY';
  autoRenew: boolean;
}

export interface CachedRecipientsResponse {
  fromEmail: string;
  resendConfigured: boolean;
  recipients: CachedRecipient[];
  summary: { total: number; pending: number; alreadySent: number };
}

const recipientsCaches = new Map<string, CachedRecipientsResponse>();

export function getRecipientsCache(cohortId: string): CachedRecipientsResponse | undefined {
  return recipientsCaches.get(cohortId);
}

export function setRecipientsCache(cohortId: string, payload: CachedRecipientsResponse): void {
  recipientsCaches.set(cohortId, payload);
}

export function hasRecipientsCache(cohortId: string): boolean {
  return recipientsCaches.has(cohortId);
}

export function prewarmRecipientsCache(cohortId: string, payload: CachedRecipientsResponse): void {
  recipientsCaches.set(cohortId, payload);
}
