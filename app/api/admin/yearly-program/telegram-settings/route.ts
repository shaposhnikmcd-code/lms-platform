import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import {
  getYearlyProgramTelegramSettings,
  validateAndSaveChatId,
  setAutoAddFlag,
  clearChatId,
} from '@/lib/yearlyProgramTelegram';

/// GET — повертає поточні налаштування Telegram-каналу.
/// POST — body: `{ action: "save", chatId: string }` — резолвить через Bot API getChat і зберігає.
///        body: `{ action: "toggle-auto", autoAdd: boolean }` — перемикач auto-add.
///        body: `{ action: "clear" }` — скидає chatId і вимикає autoAdd.

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

  if (action === 'clear') {
    const settings = await clearChatId(adminEmail);
    return NextResponse.json({ settings });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
