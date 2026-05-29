import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import {
  getYearlyProgramTelegramSettings,
  validateAndSaveChatId,
  setAutoAddFlag,
  setJoinRequestModeFlag,
  clearChatId,
} from '@/lib/yearlyProgramTelegram';
import { createChatInviteLink, TelegramApiError } from '@/lib/telegram';
import { sendYearlyProgramWelcomeEmail } from '@/lib/yearlyProgramWelcomeEmail';

/// GET — повертає поточні налаштування Telegram-каналу.
/// POST — body: `{ action: "save", chatId: string }` — резолвить через Bot API getChat і зберігає.
///        body: `{ action: "toggle-auto", autoAdd: boolean }` — перемикач auto-add.
///        body: `{ action: "toggle-join-request", joinRequestMode: boolean }` — режим заявок на вступ.
///        body: `{ action: "clear" }` — скидає chatId і вимикає autoAdd + joinRequestMode.

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const settings = await getYearlyProgramTelegramSettings();
  return NextResponse.json({ settings, hasBotToken: Boolean(process.env.TELEGRAM_BOT_TOKEN) });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const adminEmail = (await getAdminActor(req))?.email ?? null;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = body.action;

  if (action === 'save') {
    const chatId = typeof body.chatId === 'string' ? body.chatId : '';
    if (!chatId.trim()) {
      return NextResponse.json({ error: 'Вкажіть chatId або @username' }, { status: 400 });
    }
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return NextResponse.json(
        { error: 'TELEGRAM_BOT_TOKEN не налаштований у env. Додайте токен бота і перезапустіть сервер.' },
        { status: 400 },
      );
    }
    const result = await validateAndSaveChatId(chatId, adminEmail);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ settings: result.settings });
  }

  if (action === 'toggle-auto') {
    if (typeof body.autoAdd !== 'boolean') {
      return NextResponse.json({ error: 'autoAdd має бути boolean' }, { status: 400 });
    }
    // Захист від "auto ON, але каналу немає".
    if (body.autoAdd) {
      const current = await getYearlyProgramTelegramSettings();
      if (!current.chatId) {
        return NextResponse.json(
          { error: 'Спочатку налаштуйте Telegram-канал, потім вмикайте автододавання.' },
          { status: 400 },
        );
      }
    }
    const settings = await setAutoAddFlag(body.autoAdd, adminEmail);
    return NextResponse.json({ settings });
  }

  if (action === 'toggle-join-request') {
    if (typeof body.joinRequestMode !== 'boolean') {
      return NextResponse.json({ error: 'joinRequestMode має бути boolean' }, { status: 400 });
    }
    if (body.joinRequestMode) {
      const current = await getYearlyProgramTelegramSettings();
      if (!current.chatId) {
        return NextResponse.json(
          { error: 'Спочатку налаштуйте Telegram-канал, потім вмикайте режим заявок.' },
          { status: 400 },
        );
      }
    }
    const settings = await setJoinRequestModeFlag(body.joinRequestMode, adminEmail);
    return NextResponse.json({ settings });
  }

  if (action === 'clear') {
    const settings = await clearChatId(adminEmail);
    return NextResponse.json({ settings });
  }

  // Тестовий лист: генерує РЕАЛЬНЕ одноразове invite-посилання для налаштованого
  // каналу і шле welcome-лист (з телеграм-секцією) на вказаний email. Дозволяє
  // перевірити, що канал підключено і секція коректно зʼявляється в листі — без
  // реальної покупки. Підписку/Payment не створює.
  if (action === 'test-email') {
    const email = (typeof body.email === 'string' && body.email.trim())
      ? body.email.trim()
      : adminEmail;
    if (!email) {
      return NextResponse.json({ error: 'Вкажіть email для тестового листа' }, { status: 400 });
    }
    const settings = await getYearlyProgramTelegramSettings();
    if (!settings.chatId) {
      return NextResponse.json({ error: 'Спочатку налаштуйте Telegram-канал.' }, { status: 400 });
    }
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN не налаштований у env.' }, { status: 400 });
    }

    let inviteLink: string | null = null;
    try {
      const link = await createChatInviteLink({
        chatId: settings.chatId,
        name: 'UIMP test',
        ...(settings.joinRequestMode ? { createsJoinRequest: true } : { memberLimit: 1 }),
        expireSeconds: 24 * 60 * 60,
      });
      inviteLink = link.invite_link;
    } catch (e) {
      const msg = e instanceof TelegramApiError ? e.message : (e instanceof Error ? e.message : String(e));
      return NextResponse.json({ error: `Не вдалось згенерувати invite-посилання: ${msg}` }, { status: 502 });
    }

    const res = await sendYearlyProgramWelcomeEmail({
      to: email,
      name: 'Тест',
      plan: 'YEARLY',
      autoRenew: false,
      telegramInviteLink: inviteLink,
    });
    if (res.skipped) {
      return NextResponse.json({ error: 'Лист не надіслано: мейлер не налаштований (немає RESEND_API_KEY на цьому середовищі).' }, { status: 400 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: res.error ?? 'Не вдалось надіслати лист' }, { status: 502 });
    }
    return NextResponse.json({ ok: true, email, inviteGenerated: Boolean(inviteLink) });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
