import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin } from '@/lib/adminAuth';
import { PAYMENT_TEMPLATES, PAYMENT_TEMPLATE_GROUPS, type PaymentTemplateKey } from '@/lib/emailTemplates/paymentTemplates';

const BUNDLE_GROUPS = new Set(['bundle']);

/// GET — список шаблонів категорії «📦 Курси і Пакети». Тонкий список (без HTML-тіла).
/// Фільтрує global PAYMENT_TEMPLATES реєстр по `group=bundle`. CRUD ручки на /[key].
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const customRows = await prisma.emailTemplate.findMany({
    select: { templateKey: true, updatedAt: true, updatedBy: true },
  });
  const customByKey = new Map(customRows.map((r) => [r.templateKey, r]));

  const items = (Object.keys(PAYMENT_TEMPLATES) as PaymentTemplateKey[])
    .filter((key) => BUNDLE_GROUPS.has(PAYMENT_TEMPLATES[key].group))
    .map((key) => {
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

  const groups = PAYMENT_TEMPLATE_GROUPS.filter((g) => BUNDLE_GROUPS.has(g.id));

  return NextResponse.json({ items, groups });
}
