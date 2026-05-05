/// PATCH/DELETE одного менеджера. Доступ: ADMIN або MANAGER.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sendConnectorMessage, isConnectorBotConfigured, ConnectorTelegramError } from '@/lib/telegramConnector';
import { sendEmail } from '@/lib/mailer';

async function requireStaff() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  return role === 'ADMIN' || role === 'MANAGER';
}

function normalizeStr(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t || null;
}

function normalizeChatId(v: unknown): string | null {
  const s = normalizeStr(v);
  if (!s) return null;
  if (!/^-?\d+$/.test(s)) return null;
  return s;
}

function normalizeEmail(v: unknown): string | null {
  const s = normalizeStr(v);
  if (!s) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
  return s.toLowerCase();
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireStaff())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Спеціальна action — тестове повідомлення.
  if (body.action === 'send-test') {
    const m = await prisma.konektorManager.findUnique({ where: { id } });
    if (!m) return NextResponse.json({ error: 'Менеджер не знайдений' }, { status: 404 });

    const results: { channel: 'email' | 'telegram'; ok: boolean; error?: string }[] = [];

    if (m.email) {
      try {
        const r = await sendEmail({
          to: m.email,
          subject: '🧪 Тестове повідомлення — UIMP «Конектор»',
          html: `
            <div style="font-family:-apple-system,sans-serif;padding:24px;background:#fafaf9">
              <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e7e5e4;border-radius:12px;padding:24px">
                <h2 style="margin:0 0 12px;color:#1c1917">🧪 Тест канал email</h2>
                <p style="color:#57534e;line-height:1.6">Якщо ти бачиш цей лист — email-канал для менеджера <b>${m.label}</b> працює коректно. Реальні повідомлення про замовлення приходитимуть у такому ж форматі.</p>
              </div>
            </div>`,
        });
        results.push({ channel: 'email', ok: r.ok, error: r.error });
      } catch (e) {
        results.push({ channel: 'email', ok: false, error: e instanceof Error ? e.message : 'Unknown' });
      }
    }

    if (m.telegramChatId && isConnectorBotConfigured()) {
      try {
        await sendConnectorMessage({
          chatId: m.telegramChatId,
          text:
            `🧪 <b>Тестове повідомлення</b>\n\nЯкщо ти бачиш це — канал Telegram для менеджера <b>${m.label}</b> працює. Реальні сповіщення про замовлення «Конектор» приходитимуть сюди.`,
        });
        results.push({ channel: 'telegram', ok: true });
      } catch (e) {
        const msg = e instanceof ConnectorTelegramError ? e.message : (e instanceof Error ? e.message : 'Unknown');
        results.push({ channel: 'telegram', ok: false, error: msg });
      }
    }

    if (results.length === 0) {
      return NextResponse.json({ error: 'У менеджера не задано жодного каналу' }, { status: 400 });
    }
    return NextResponse.json({ results });
  }

  // Звичайний апдейт полів.
  const data: Record<string, unknown> = {};

  if ('label' in body) {
    const label = normalizeStr(body.label);
    if (!label) return NextResponse.json({ error: 'Поле "Назва" обов\'язкове' }, { status: 400 });
    data.label = label;
  }
  if ('email' in body) {
    if (body.email === null || body.email === '') data.email = null;
    else {
      const email = normalizeEmail(body.email);
      if (!email) return NextResponse.json({ error: 'Невалідний email' }, { status: 400 });
      data.email = email;
    }
  }
  if ('telegramChatId' in body) {
    if (body.telegramChatId === null || body.telegramChatId === '') data.telegramChatId = null;
    else {
      const chatId = normalizeChatId(body.telegramChatId);
      if (!chatId) return NextResponse.json({ error: 'Telegram chat_id має бути числом' }, { status: 400 });
      data.telegramChatId = chatId;
    }
  }
  if ('enabled' in body) data.enabled = Boolean(body.enabled);
  if ('notifyOnNew' in body) data.notifyOnNew = Boolean(body.notifyOnNew);
  if ('notifyOnPaid' in body) data.notifyOnPaid = Boolean(body.notifyOnPaid);

  // Перевіряємо що після апдейту хоча б один канал заповнений.
  if ('email' in body || 'telegramChatId' in body) {
    const current = await prisma.konektorManager.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: 'Менеджер не знайдений' }, { status: 404 });
    const finalEmail = 'email' in data ? data.email : current.email;
    const finalChatId = 'telegramChatId' in data ? data.telegramChatId : current.telegramChatId;
    if (!finalEmail && !finalChatId) {
      return NextResponse.json(
        { error: 'Заповніть хоча б один канал — email або Telegram chat_id' },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.konektorManager.update({ where: { id }, data });
  return NextResponse.json({ manager: updated });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireStaff())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await ctx.params;
  await prisma.konektorManager.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
