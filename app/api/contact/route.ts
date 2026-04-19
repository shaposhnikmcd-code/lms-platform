import { Resend } from 'resend';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/ratelimit';

const resend = new Resend(process.env.RESEND_API_KEY);

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(req: NextRequest) {
  try {
    const rl = await checkRateLimit(req, 'contact');
    if (!rl.ok) return rl.response!;

    const { name, email, message } = await req.json();

    // Валідація: всі поля рядки, розумні межі, валідний email.
    if (
      typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string'
      || name.trim().length === 0 || name.length > 200
      || message.trim().length === 0 || message.length > 5000
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json({ success: false, error: 'Невірні дані' }, { status: 400 });
    }

    // HTML escape — `name/email/message` інтерпольовано в лист, без escape це XSS у Gmail preview.
    await resend.emails.send({
      from: 'UIMP <onboarding@resend.dev>',
      to: 'uimp.edu@gmail.com',
      subject: `Новий запит з сайту UIMP від ${esc(name)}`,
      html: `
        <h2>Новий запит з сайту UIMP</h2>
        <p><strong>Ім'я:</strong> ${esc(name)}</p>
        <p><strong>Email:</strong> ${esc(email)}</p>
        <p><strong>Повідомлення:</strong></p>
        <p>${esc(message).replace(/\n/g, '<br>')}</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
