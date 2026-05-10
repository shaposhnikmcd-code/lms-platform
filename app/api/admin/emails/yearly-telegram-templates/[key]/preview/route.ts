import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/adminAuth';
import {
  PAYMENT_TEMPLATES,
  renderTemplate,
  getPaymentTemplate,
  wrapInnerHtml,
  type PaymentTemplateKey,
} from '@/lib/emailTemplates/paymentTemplates';

function isYearlyTgKey(key: string): key is PaymentTemplateKey {
  return key in PAYMENT_TEMPLATES && PAYMENT_TEMPLATES[key as PaymentTemplateKey].group === 'yearly-telegram';
}

async function renderHtml(key: PaymentTemplateKey, subject: string, bodyHtml: string): Promise<string> {
  const meta = PAYMENT_TEMPLATES[key];
  const renderedSubject = renderTemplate(subject, meta.sampleData);
  const renderedBody = renderTemplate(bodyHtml, meta.sampleData);
  return `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${renderedSubject.replace(/[<>"']/g, '')}</title>
<style>body{margin:0;padding:12px 0 0;background:#fff;font-family:Arial,Helvetica,sans-serif;}</style>
</head>
<body>
${renderedBody}
</body>
</html>`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { key } = await params;
  if (!isYearlyTgKey(key)) {
    return NextResponse.json({ error: 'Unknown yearly-telegram template key' }, { status: 404 });
  }
  const tpl = await getPaymentTemplate(key);
  const html = await renderHtml(key, tpl.subject, tpl.bodyHtml);
  return new NextResponse(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { key } = await params;
  if (!isYearlyTgKey(key)) {
    return NextResponse.json({ error: 'Unknown yearly-telegram template key' }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { subject?: string; bodyHtml?: string; bodyInnerHtml?: string };
  const subject = typeof body.subject === 'string' ? body.subject : '';
  const bodyHtml = typeof body.bodyInnerHtml === 'string'
    ? wrapInnerHtml(body.bodyInnerHtml)
    : (typeof body.bodyHtml === 'string' ? body.bodyHtml : '');
  const html = await renderHtml(key, subject, bodyHtml);
  return new NextResponse(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
