/// Create / verify / consume для PasswordResetToken.
///
/// Security-паттерн:
/// - Сирий токен (32 байти, base64url) віддається ЛИШЕ один раз у листі.
/// - В БД зберігається тільки SHA-256 hash (навіть компрометація БД не відкриє токени).
/// - Single-use: `usedAt` ставиться при успішному consume; повторне використання блокується.
/// - TTL різний за purpose: INVITE — 7 днів, RESET — 1 година.
/// - При створенні нового токена для того ж userId ми консервативно НЕ видаляємо попередні
///   (дозволяємо кілька активних — напр., юзер двічі натиснув "Забули пароль"). Первинний
///   токен лишається валідним, поки не протерміновано.

import crypto from 'crypto';
import prisma from './prisma';
import type { PasswordResetTokenPurpose } from '@prisma/client';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 днів
const RESET_TTL_MS = 60 * 60 * 1000;            // 1 година

export function ttlMsForPurpose(purpose: PasswordResetTokenPurpose): number {
  return purpose === 'INVITE' ? INVITE_TTL_MS : RESET_TTL_MS;
}

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export interface CreatedToken {
  /// Сирий токен — йде в URL листа. Більше ніде не зберігається.
  rawToken: string;
  expiresAt: Date;
}

export async function createPasswordResetToken(args: {
  userId: string;
  purpose: PasswordResetTokenPurpose;
}): Promise<CreatedToken> {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlMsForPurpose(args.purpose));

  await prisma.passwordResetToken.create({
    data: {
      userId: args.userId,
      tokenHash,
      purpose: args.purpose,
      expiresAt,
    },
  });

  return { rawToken, expiresAt };
}

export interface VerifiedToken {
  id: string;
  userId: string;
  purpose: PasswordResetTokenPurpose;
}

/// Перевіряє токен без його використання. Повертає `null` якщо токен не знайдено,
/// протерміновано або вже використано. Для прев'ю валідності в UI (перед показом форми).
export async function verifyPasswordResetToken(rawToken: string): Promise<VerifiedToken | null> {
  if (typeof rawToken !== 'string' || rawToken.length < 20) return null;
  const tokenHash = hashToken(rawToken);

  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, purpose: true, expiresAt: true, usedAt: true },
  });

  if (!row) return null;
  if (row.usedAt) return null;
  if (row.expiresAt < new Date()) return null;

  return { id: row.id, userId: row.userId, purpose: row.purpose };
}

/// Атомарно позначає токен як використаний. Використовується в reset-password
/// разом з оновленням User.password в одній транзакції, щоб уникнути race'у
/// "два паралельні reset-и обидва проходять".
///
/// Повертає `true` якщо токен успішно позначено (був валідним і не використаним),
/// `false` — якщо токен невалідний/вже використаний/протерміновано.
export async function consumePasswordResetToken(tokenId: string): Promise<boolean> {
  const result = await prisma.passwordResetToken.updateMany({
    where: {
      id: tokenId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });
  return result.count === 1;
}
