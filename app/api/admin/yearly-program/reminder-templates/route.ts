import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin } from '@/lib/adminAuth';
import { getYearlyGraceDays } from '@/lib/yearlyProgramConfig';
import {
  REMINDER_TEMPLATES,
  REMINDER_TEMPLATE_GROUPS,
  type ReminderTemplateKey,
} from '@/lib/emailTemplates/reminderTemplates';

const DB_PREFIX = 'reminder.';

/// GET — тонкий список усіх reminder-template-ів. Тільки meta (без HTML-тіла).
/// HTML-тіло вантажиться окремо через GET /reminder-templates/:key.
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [customRows, currentGraceDays] = await Promise.all([
    prisma.emailTemplate.findMany({
      where: { templateKey: { startsWith: DB_PREFIX } },
      select: { templateKey: true, updatedAt: true, updatedBy: true },
    }),
    getYearlyGraceDays(prisma),
  ]);
  const customByKey = new Map(customRows.map((r) => [r.templateKey, r]));

  const items = (Object.keys(REMINDER_TEMPLATES) as ReminderTemplateKey[]).map((key) => {
    const meta = REMINDER_TEMPLATES[key];
    const custom = customByKey.get(`${DB_PREFIX}${key}`);
    return {
      key: meta.key,
      group: meta.group,
      title: meta.title,
      when: meta.when,
      placeholders: meta.placeholders,
      sampleData: meta.sampleData,
      minGraceDays: meta.minGraceDays ?? null,
      isCustomized: !!custom,
      updatedAt: custom?.updatedAt?.toISOString() ?? null,
      updatedBy: custom?.updatedBy ?? null,
    };
  });

  return NextResponse.json({ items, groups: REMINDER_TEMPLATE_GROUPS, currentGraceDays });
}
