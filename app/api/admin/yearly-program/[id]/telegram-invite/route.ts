import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import { sendEmail } from '@/lib/mailer';
import {
  generateInviteForSubscription,
  getYearlyProgramTelegramSettings,
  renderTelegramInviteEmailBlock,
} from '@/lib/yearlyProgramTelegram';

/// Manual-trigger Telegram invite для конкретної підписки.
/// Body: { force?: boolean, sendEmail?: boolean }
///   - force=true → перегенеровує invite-link навіть якщо вже є
///   - sendEmail=true → шле user-у listа з кнопкою "Долучитись у Telegram"
/// Викликається з адмінки в expanded-панелі підписки.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }
  const actor = await getAdminActor(req);
  const actorLabel = actor?.email ?? actor?.name ?? 'admin';
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { force?: boolean; sendEmail?: boolean };

  const settings = await getYearlyProgramTelegramSettings();
  if (!settings.chatId) {
    return NextResponse.json(
      { error: 'Telegram-канал не налаштовано. Спочатку додайте канал у налаштуваннях.' },
      { status: 400 },
    );
  }

  const sub = await prisma.yearlyProgramSubscription.findUnique({
    where: { id },
    select: {
      id: true,
      telegramInviteLink: true,
      telegramUsername: true,
      user: { select: { email: true, name: true } },
    },
  });
  if (!sub) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }

  const result = await generateInviteForSubscription({
    subscriptionId: id,
    force: body.force === true,
    triggeredBy: `admin:${actorLabel}`,
    prefetched: {
      id: sub.id,
      telegramInviteLink: sub.telegramInviteLink,
      userEmail: sub.user?.email ?? null,
      userName: sub.user?.name ?? null,
    },
  });

  if (!result.ok || !result.inviteLink) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  // Опційний email з invite-кнопкою (за замовчуванням так — менеджер хоче щоб юзер отримав).
  let emailResult: { sent: boolean; error?: string } = { sent: false };
  if (body.sendEmail !== false && sub.user?.email) {
    const greeting = sub.user.name && sub.user.name.trim()
      ? `Доброго дня, ${sub.user.name.trim()}!`
      : 'Доброго дня!';
    const intro = `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a; line-height: 1.6;">
  <h2 style="margin: 0 0 16px;">Запрошення до Telegram-каналу</h2>
  <p style="margin: 0 0 12px;">${greeting}</p>
  <p style="margin: 0 0 16px;">Долучайтесь до нашого Telegram-каналу Річної програми Українського інституту Душеопіки та Психотерапії (UIMP) — там ми ділимось новинами, нагадуваннями та відповідаємо на питання щодо організації навчання.</p>
</div>`.trim();
    const fullHtml = intro + renderTelegramInviteEmailBlock(result.inviteLink);
    // Унікалізуємо subject timestamp-ом, щоб Gmail не схлопнув кілька resend-листів
    // у thread як "процитований контент" (виглядає як "..." у тілі для отримувача).
    const now = new Date();
    const stamp = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    try {
      const r = await sendEmail({
        to: sub.user.email,
        subject: `Запрошення до Telegram-каналу Річної програми · ${stamp}`,
        html: fullHtml,
        replyTo: 'edu@uimp.com.ua',
      });
      emailResult = { sent: r.ok, error: r.error };
      if (r.ok) {
        await prisma.yearlyProgramSubscriptionEvent.create({
          data: {
            subscriptionId: id,
            type: 'admin_action',
            message: `Telegram invite надіслано листом (${actorLabel})`,
            metadata: { triggeredBy: actorLabel, messageId: r.messageId },
          },
        });
      }
    } catch (e) {
      emailResult = { sent: false, error: (e as Error).message.slice(0, 200) };
    }
  }

  return NextResponse.json({
    ok: true,
    inviteLink: result.inviteLink,
    email: emailResult,
  });
}
