import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin } from '@/lib/adminAuth';
import { PAYMENT_TEMPLATES, type PaymentTemplateKey } from '@/lib/emailTemplates/paymentTemplates';

/// GET — список усіх payment-template-ів з поточними значеннями (custom з БД або дефолт)
/// + метаінформацією (placeholders, sampleData, when). Використовується UI-модалкою
/// "Листи платежів" в адмінці.
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const customRows = await prisma.emailTemplate.findMany();
  const customByKey = new Map(customRows.map((r) => [r.templateKey, r]));

  const items = (Object.keys(PAYMENT_TEMPLATES) as PaymentTemplateKey[]).map((key) => {
    const meta = PAYMENT_TEMPLATES[key];
    const custom = customByKey.get(key);
    return {
      key: meta.key,
      title: meta.title,
      when: meta.when,
      placeholders: meta.placeholders,
      sampleData: meta.sampleData,
      subject: custom?.subject ?? meta.defaultSubject,
      bodyHtml: custom?.bodyHtml ?? meta.defaultBodyHtml,
      defaultSubject: meta.defaultSubject,
      defaultBodyHtml: meta.defaultBodyHtml,
      isCustomized: !!custom,
      updatedAt: custom?.updatedAt?.toISOString() ?? null,
      updatedBy: custom?.updatedBy ?? null,
    };
  });

  return NextResponse.json({ items });
}
