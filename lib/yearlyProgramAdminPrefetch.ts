/// Server-side prefetch для адмінки Річної програми. Збирає дані, які поточно ленді-fetch-аються
/// з модалок (templates lists, recipients), щоб клієнт отримав їх одразу через props і не чекав
/// окремого HTTP-roundtrip при кожному відкритті модалки.
///
/// Використовується ВИКЛЮЧНО з server components (page.tsx). Не імпортувати з 'use client'.

import prisma from '@/lib/prisma';
import {
  PAYMENT_TEMPLATES,
  PAYMENT_TEMPLATE_GROUPS,
  type PaymentTemplateKey,
} from '@/lib/emailTemplates/paymentTemplates';
import {
  REMINDER_TEMPLATES,
  REMINDER_TEMPLATE_GROUPS,
  type ReminderTemplateKey,
} from '@/lib/emailTemplates/reminderTemplates';
import { MAILER_FROM_EMAIL, isMailerConfigured } from '@/lib/mailer';

const REMINDER_DB_PREFIX = 'reminder.';

export interface PrewarmedTemplateListItem {
  key: string;
  group: string;
  title: string;
  when: string;
  placeholders: string[];
  sampleData: Record<string, string>;
  isCustomized: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface PrewarmedTemplateGroup {
  id: string;
  title: string;
  description: string;
}

export interface PrewarmedTemplateList {
  items: PrewarmedTemplateListItem[];
  groups: PrewarmedTemplateGroup[];
}

export interface PrewarmedRecipient {
  subscriptionId: string;
  name: string | null;
  email: string;
  alreadySent: boolean;
  sentAt: string | null;
  hasPaidPayment: boolean;
  plan: 'YEARLY' | 'MONTHLY';
  autoRenew: boolean;
}

export interface PrewarmedRecipientsResponse {
  fromEmail: string;
  resendConfigured: boolean;
  recipients: PrewarmedRecipient[];
  summary: { total: number; pending: number; alreadySent: number };
}

export interface YearlyProgramAdminPrewarm {
  templates: {
    payment: PrewarmedTemplateList;
    reminder: PrewarmedTemplateList;
  };
  /// Recipients для cohort-ів, де кнопка «Дослати лист» доступна (launchedAt != null).
  /// Ключ — cohortId. Дозволяє SendEmailsModal стартувати без fetch-а.
  recipientsByCohort: Record<string, PrewarmedRecipientsResponse>;
}

async function buildPaymentTemplatesList(): Promise<PrewarmedTemplateList> {
  const customRows = await prisma.emailTemplate.findMany({
    where: { templateKey: { notIn: [], in: Object.keys(PAYMENT_TEMPLATES) as PaymentTemplateKey[] } },
    select: { templateKey: true, updatedAt: true, updatedBy: true },
  });
  const customByKey = new Map(customRows.map((r) => [r.templateKey, r]));

  const items: PrewarmedTemplateListItem[] = (Object.keys(PAYMENT_TEMPLATES) as PaymentTemplateKey[]).map((key) => {
    const meta = PAYMENT_TEMPLATES[key];
    const custom = customByKey.get(key);
    return {
      key: meta.key,
      group: meta.group,
      title: meta.title,
      when: meta.when,
      placeholders: meta.placeholders,
      sampleData: meta.sampleData,
      isCustomized: !!custom,
      updatedAt: custom?.updatedAt?.toISOString() ?? null,
      updatedBy: custom?.updatedBy ?? null,
    };
  });

  return { items, groups: [...PAYMENT_TEMPLATE_GROUPS] };
}

async function buildReminderTemplatesList(): Promise<PrewarmedTemplateList> {
  const customRows = await prisma.emailTemplate.findMany({
    where: { templateKey: { startsWith: REMINDER_DB_PREFIX } },
    select: { templateKey: true, updatedAt: true, updatedBy: true },
  });
  const customByKey = new Map(customRows.map((r) => [r.templateKey, r]));

  const items: PrewarmedTemplateListItem[] = (Object.keys(REMINDER_TEMPLATES) as ReminderTemplateKey[]).map((key) => {
    const meta = REMINDER_TEMPLATES[key];
    const custom = customByKey.get(`${REMINDER_DB_PREFIX}${key}`);
    return {
      key: meta.key,
      group: meta.group,
      title: meta.title,
      when: meta.when,
      placeholders: meta.placeholders,
      sampleData: meta.sampleData,
      isCustomized: !!custom,
      updatedAt: custom?.updatedAt?.toISOString() ?? null,
      updatedBy: custom?.updatedBy ?? null,
    };
  });

  return { items, groups: [...REMINDER_TEMPLATE_GROUPS] };
}

/// Recipients для одного cohort-у — логіка 1-в-1 з API endpoint /recipients.
/// Викликається паралельно для всіх cohort-ів зі статусом launched.
async function buildRecipientsForCohort(cohortId: string): Promise<PrewarmedRecipientsResponse> {
  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      cohortId,
      status: { in: ['PENDING', 'ACTIVE', 'GRACE'] },
    },
    include: {
      user: { select: { name: true, email: true } },
      events: {
        where: { type: 'launch_email_sent' },
        select: { metadata: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
      payments: {
        where: { status: 'PAID' },
        select: { id: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const recipients: PrewarmedRecipient[] = subs
    .filter((s) => s.user?.email)
    .map((s) => {
      const lastSent = s.events.find((ev) => {
        const m = ev.metadata as { cohortId?: string } | null;
        return m?.cohortId === cohortId;
      });
      return {
        subscriptionId: s.id,
        name: s.user?.name ?? null,
        email: s.user!.email,
        alreadySent: !!lastSent,
        sentAt: lastSent?.createdAt.toISOString() ?? null,
        hasPaidPayment: s.payments.length > 0,
        plan: s.plan,
        autoRenew: s.autoRenew,
      };
    });

  return {
    fromEmail: MAILER_FROM_EMAIL,
    resendConfigured: isMailerConfigured(),
    recipients,
    summary: {
      total: recipients.length,
      pending: recipients.filter((r) => !r.alreadySent).length,
      alreadySent: recipients.filter((r) => r.alreadySent).length,
    },
  };
}

/// Збирає весь prewarm-payload одним server-side проходом.
/// `launchedCohortIds` — id cohort-ів, для яких треба recipients. Передається з page.tsx
/// після первинного fetch cohorts (щоб не дублювати запит).
export async function buildYearlyProgramAdminPrewarm(launchedCohortIds: string[]): Promise<YearlyProgramAdminPrewarm> {
  const [paymentList, reminderList, recipientsEntries] = await Promise.all([
    buildPaymentTemplatesList(),
    buildReminderTemplatesList(),
    Promise.all(
      launchedCohortIds.map(async (id) => [id, await buildRecipientsForCohort(id)] as const),
    ),
  ]);

  const recipientsByCohort: Record<string, PrewarmedRecipientsResponse> = {};
  for (const [id, payload] of recipientsEntries) {
    recipientsByCohort[id] = payload;
  }

  return {
    templates: { payment: paymentList, reminder: reminderList },
    recipientsByCohort,
  };
}
