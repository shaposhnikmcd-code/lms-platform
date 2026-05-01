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
  hasRecToken: boolean;
  sendpulseStudentId: number | null;
  sendpulseAccessOpenedAt: string | null;
  sendpulseAccessClosedAt: string | null;
  paymentsCount: number;
  totalPaid: number;
}

export interface SummaryData {
  total: number;
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
  emailScheduledFor: string | null;
  emailSentAt: string | null;
  launchEmailSubject: string | null;
  launchEmailBody: string | null;
  isCurrent: boolean;
  subscriptionsCount: number;
}

export type CohortFilter = 'ALL' | string; // 'ALL' or cohortId
