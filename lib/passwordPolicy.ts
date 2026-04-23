/// Єдина політика складності пароля — використовується в register, reset-password
/// та admin "встановити пароль". Якщо треба посилити вимоги — правимо тут, все
/// інше підхоплює автоматично.

import { countPwnedOccurrences } from './hibp';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 200;

export type PasswordValidationResult =
  | { ok: true }
  | { ok: false; message: string };

/// Синхронно перевіряє довжину. HIBP — окремо, бо мережевий виклик.
export function validatePasswordShape(password: unknown): PasswordValidationResult {
  if (typeof password !== 'string') {
    return { ok: false, message: 'Пароль обовʼязковий' };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, message: `Пароль має бути щонайменше ${PASSWORD_MIN_LENGTH} символів` };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, message: `Пароль занадто довгий (максимум ${PASSWORD_MAX_LENGTH})` };
  }
  return { ok: true };
}

/// Повна перевірка: довжина + HIBP breach. Мережева — повертає Promise.
/// HIBP fail-open: якщо мережа впала — пропускаємо (як у register).
export async function validatePasswordFull(password: unknown): Promise<PasswordValidationResult> {
  const shape = validatePasswordShape(password);
  if (!shape.ok) return shape;

  const pwnedCount = await countPwnedOccurrences(password as string);
  if (pwnedCount > 0) {
    return {
      ok: false,
      message: `Цей пароль скомпрометований у відомих зливах (${pwnedCount} разів). Оберіть інший.`,
    };
  }
  return { ok: true };
}
