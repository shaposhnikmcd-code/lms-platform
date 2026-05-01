import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/adminAuth';
import { MAILER_FROM_EMAIL, isMailerConfigured } from '@/lib/mailer';

/// Конфіг розсилки для UI: яку From-адресу побачать одержувачі і чи реально
/// підключений Resend. Використовується <MailerFromBadge /> в адмінках, які
/// тригерять розсилки (Річна програма, Сертифікати тощо).
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }
  return NextResponse.json({
    fromEmail: MAILER_FROM_EMAIL,
    resendConfigured: isMailerConfigured(),
  });
}
