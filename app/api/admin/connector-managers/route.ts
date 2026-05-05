/// CRUD для відповідальних менеджерів гри «Конектор».
/// Доступ: ADMIN або MANAGER (симетрично з /api/connector PATCH/GET).

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

async function requireStaff() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  return role === 'ADMIN' || role === 'MANAGER';
}

interface ManagerInput {
  label?: unknown;
  email?: unknown;
  telegramChatId?: unknown;
  enabled?: unknown;
  emailEnabled?: unknown;
  telegramEnabled?: unknown;
  notifyOnNew?: unknown;
  notifyOnPaid?: unknown;
}

function normalizeStr(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t || null;
}

function normalizeChatId(v: unknown): string | null {
  const s = normalizeStr(v);
  if (!s) return null;
  // Лише numeric chat_id (особистий або груповий, груповий починається з "-").
  // @username — не підходить, бо боти НЕ можуть писати першими через handle.
  if (!/^-?\d+$/.test(s)) return null;
  return s;
}

function normalizeEmail(v: unknown): string | null {
  const s = normalizeStr(v);
  if (!s) return null;
  // Базова перевірка — детальніше перевірить Resend.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
  return s.toLowerCase();
}

export async function GET() {
  if (!(await requireStaff())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const managers = await prisma.konektorManager.findMany({
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({
    managers,
    botUsername: 'connectorgame_bot',
    botConfigured: Boolean(process.env.TELEGRAM_CONNECTOR_BOT_TOKEN?.trim()),
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireStaff())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as ManagerInput;

  const label = normalizeStr(body.label);
  if (!label) {
    return NextResponse.json({ error: 'Поле "Назва/Ім\'я" обов\'язкове' }, { status: 400 });
  }

  const email = body.email === null || body.email === '' ? null : normalizeEmail(body.email);
  if (body.email !== null && body.email !== undefined && body.email !== '' && !email) {
    return NextResponse.json({ error: 'Невалідний email' }, { status: 400 });
  }

  const telegramChatId =
    body.telegramChatId === null || body.telegramChatId === '' ? null : normalizeChatId(body.telegramChatId);
  if (
    body.telegramChatId !== null &&
    body.telegramChatId !== undefined &&
    body.telegramChatId !== '' &&
    !telegramChatId
  ) {
    return NextResponse.json(
      { error: 'Telegram chat_id має бути числом (отриманим від бота /start)' },
      { status: 400 },
    );
  }

  if (!email && !telegramChatId) {
    return NextResponse.json(
      { error: 'Заповніть хоча б один канал — email або Telegram chat_id' },
      { status: 400 },
    );
  }

  const created = await prisma.konektorManager.create({
    data: {
      label,
      email,
      telegramChatId,
      enabled: body.enabled === undefined ? true : Boolean(body.enabled),
      emailEnabled: body.emailEnabled === undefined ? true : Boolean(body.emailEnabled),
      telegramEnabled: body.telegramEnabled === undefined ? true : Boolean(body.telegramEnabled),
      notifyOnNew: body.notifyOnNew === undefined ? true : Boolean(body.notifyOnNew),
      notifyOnPaid: body.notifyOnPaid === undefined ? true : Boolean(body.notifyOnPaid),
    },
  });
  return NextResponse.json({ manager: created });
}
