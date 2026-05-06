import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin } from '@/lib/adminAuth';
import { PAYMENT_TEMPLATES, PAYMENT_TEMPLATE_GROUPS, type PaymentTemplateKey } from '@/lib/emailTemplates/paymentTemplates';

/// GET — тонкий список усіх payment-template-ів. Тільки meta (без HTML-тіла).
/// HTML-тіло вантажиться окремо, коли менеджер відкриває конкретний шаблон
/// через GET /payment-templates/:key. Зменшує payload з ~100 KB до ~3 KB.
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Selecting only meta fields reduces query size and serialization time.
  const customRows = await prisma.emailTemplate.findMany({
    select: { templateKey: true, updatedAt: true, updatedBy: true },
  });
  const customByKey = new Map(customRows.map((r) => [r.templateKey, r]));

  const items = (Object.keys(PAYMENT_TEMPLATES) as PaymentTemplateKey[]).map((key) => {
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

  return NextResponse.json({ items, groups: PAYMENT_TEMPLATE_GROUPS });
}
