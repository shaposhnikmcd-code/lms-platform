import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin } from '@/lib/adminAuth';
import { PAYMENT_TEMPLATES, PAYMENT_TEMPLATE_GROUPS, YEARLY_PAYMENT_GROUPS, type PaymentTemplateKey } from '@/lib/emailTemplates/paymentTemplates';

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

  // Yearly-program scope = групи payment/plan-change/admin-end (без bundle і без welcome).
  // Welcome винесено в окрему групу 'welcome' (вікно «🎓 Річна — Welcome»).
  // Bundle-template-и обробляються окремим API: /api/admin/emails/bundle-templates.
  const YEARLY_GROUPS = new Set<string>(YEARLY_PAYMENT_GROUPS);

  const items = (Object.keys(PAYMENT_TEMPLATES) as PaymentTemplateKey[])
    .filter((key) => YEARLY_GROUPS.has(PAYMENT_TEMPLATES[key].group))
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

  const groups = PAYMENT_TEMPLATE_GROUPS.filter((g) => YEARLY_GROUPS.has(g.id));

  return NextResponse.json({ items, groups });
}
