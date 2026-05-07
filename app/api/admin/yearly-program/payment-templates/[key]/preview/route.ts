import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/adminAuth';
import {
  PAYMENT_TEMPLATES,
  renderTemplate,
  getPaymentTemplate,
  wrapInnerHtml,
  type PaymentTemplateKey,
} from '@/lib/emailTemplates/paymentTemplates';

/// GET — рендерить ПОТОЧНИЙ збережений шаблон (custom з БД або default з коду)
/// з sample-data → HTML для iframe.src. Використовується для "view current" режиму.
///
/// POST — рендерить ПЕРЕДАНИЙ draft (body { subject, bodyHtml }) → HTML.
/// Використовується для real-time preview під час редагування — UI POSTить
/// поточний стан editor-у і пише результат у iframe.srcdoc.
async function renderHtml(key: string, subject: string, bodyHtml: string): Promise<string> {
  const meta = PAYMENT_TEMPLATES[key as PaymentTemplateKey];
  const renderedSubject = renderTemplate(subject, meta.sampleData);
  const renderedBody = renderTemplate(bodyHtml, meta.sampleData);
  // Тема не дублюється в iframe — EmailPreviewFrame показує її в chrome рамці.
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
  if (!(key in PAYMENT_TEMPLATES)) {
    return NextResponse.json({ error: 'Unknown template key' }, { status: 404 });
  }
  const tpl = await getPaymentTemplate(key as PaymentTemplateKey);
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
  if (!(key in PAYMENT_TEMPLATES)) {
    return NextResponse.json({ error: 'Unknown template key' }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { subject?: string; bodyHtml?: string; bodyInnerHtml?: string };
  const subject = typeof body.subject === 'string' ? body.subject : '';
  // WYSIWYG-режим: приходить inner-HTML, обгортаємо в стандартний layout перед рендером.
  const bodyHtml = typeof body.bodyInnerHtml === 'string'
    ? wrapInnerHtml(body.bodyInnerHtml)
    : (typeof body.bodyHtml === 'string' ? body.bodyHtml : '');
  const html = await renderHtml(key, subject, bodyHtml);
  return new NextResponse(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
