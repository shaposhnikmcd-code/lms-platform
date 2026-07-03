/// Спільні типи для cohort-фічі. Розділено від YearlyProgramView щоб уникнути
/// циклів імпорту з модальних вікон та action-блоку.

export type Plan = 'YEARLY' | 'MONTHLY';
export type SubStatus = 'PENDING' | 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'CANCELLED' | 'ARCHIVED';

export interface Row {
  id: string;
  createdAt: string;
  userName: string | null;
  userEmail: string;
  plan: Plan;
  autoRenew: boolean;
  status: SubStatus;
  startDate: string | null;
  expiresAt: string | null;
  daysLeft: number | null;
  /// Дата + час фактичної першої успішної оплати (=> Дата оплати в таблиці).
  firstPaymentAt: string | null;
  /// Початок програми = cohort.startDate (якщо є cohort).
  cohortStartDate: string | null;
  cohortName: string | null;
  cohortId: string | null;
  cohortLaunched: boolean;
  cancelledAt: string | null;
  cancelledBy: string | null;
  lastPaymentAt: string | null;
  failedChargeCount: number;
  lastChargeError: string | null;
  sendpulseStudentId: number | null;
  sendpulseAccessOpenedAt: string | null;
  sendpulseAccessClosedAt: string | null;
  paymentsCount: number;
  totalPaid: number;
  /// Кеш дати наступного автосписання з WFP (wfpNextChargeAt). Тільки для MONTHLY
  /// автоплатежу з живою регулярку; null = разова/річна або правила у WFP немає.
  wfpNextChargeAt: string | null;
  /// Коли кеш востаннє звіряли з WFP (wfpScheduleCheckedAt).
  wfpScheduleCheckedAt: string | null;
  /// Метод останньої успішної оплати: "applePay" | "googlePay" | "card" | null.
  paymentMethod: string | null;
  /// Для PENDING — реальна причина з останньої спроби оплати (замість «Очікує»). null для не-PENDING.
  pendingLabel: string | null;
  pendingTone: 'neutral' | 'reject' | null;
  /// Manual-add: коли менеджер створив підписку через invite-link (замість звичайної реєстрації).
  /// Якщо != null → показуємо пілюлю "Додано вручну" + дозволяємо "Екстра Запуск".
  manuallyAddedAt: string | null;
  manuallyAddedBy: string | null;
  /// Дані з форми оплати: ISO-2 код країни проживання + телефон + Telegram username.
  country: string | null;
  phone: string | null;
  telegramUsername: string | null;
  telegramInviteLink: string | null;
  telegramInvitedAt: string | null;
  /// telegramJoinedAt — момент, коли клієнт реально потрапив у канал
  /// (`approveChatJoinRequest` від webhook у режимі joinRequestMode).
  /// null якщо ще не приєднався.
  telegramJoinedAt: string | null;
  /// telegramLeftAt — момент leave/kick. Якщо є — клієнт уже не в каналі.
  /// При rejoin webhook скидає в null і оновлює telegramJoinedAt.
  telegramLeftAt: string | null;
}

export interface SummaryData {
  total: number;
  pending: number;
  active: number;
  grace: number;
  expired: number;
  cancelled: number;
  revenueTotal: number;
}

export interface CohortListItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  launchedAt: string | null;
  /// Запланований запуск (cron виконає коли час прийде). null якщо запуск миттєвий або не запланований.
  launchScheduledFor: string | null;
  emailScheduledFor: string | null;
  emailSentAt: string | null;
  launchEmailSubject: string | null;
  launchEmailBody: string | null;
  isCurrent: boolean;
  subscriptionsCount: number;
}

export type CohortFilter = 'ALL' | string; // 'ALL' or cohortId
