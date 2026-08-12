import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '@/lib/auth';

/// Захищені акаунти: критичні адміни, яких не можна видалити чи понизити в ролі
/// ні через UI, ні через прямий API-виклик (defense in depth). Ці два акаунти
/// вшиті в код навмисно: якщо env загубиться при міграції проєкту, власник не
/// має втратити контроль над платформою.
const HARDCODED_PROTECTED_ACCOUNTS = [
  'shaposhnik.mcd@gmail.com',
  'saposniktana878@gmail.com',
];

/// ЄДИНЕ ДЖЕРЕЛО super-admin/protected акаунтів: вшитий список + env
/// `SUPER_ADMIN_EMAILS` (comma-separated, case-insensitive). Super-admin — це
/// ADMIN з додатковими правами на rare-операції (відмінити запуск cohort-у,
/// змінити роль іншого адміна, видалити адміна).
///
/// Чому env, а не DB-роль: у нас один-два super-admin-и (власники проєкту),
/// потреба в UI для керування списком відсутня. Vercel env шифрований, аудит
/// зміни є. Якщо згодом super-admin-ів стане ≥3 — варто перевести на DB-роль.
export function getProtectedAccounts(): Set<string> {
  const set = new Set(HARDCODED_PROTECTED_ACCOUNTS);
  for (const raw of (process.env.SUPER_ADMIN_EMAILS ?? '').split(',')) {
    const email = raw.trim().toLowerCase();
    if (email) set.add(email);
  }
  return set;
}

/// Чи належить email до захищених/super-admin акаунтів.
export function isProtectedAccount(email?: string | null): boolean {
  if (!email) return false;
  return getProtectedAccounts().has(email.toLowerCase());
}

/// Перевіряє чи поточний користувач — super-admin.
/// Працює і в API routes (з `req`), і в server components (без `req` — через
/// `getServerSession`, що читає cookies автоматично).
/// Гарантовано вимагає role === 'ADMIN' (super-admin = admin++, не bypass).
export async function isSuperAdmin(req?: NextRequest): Promise<boolean> {
  const allowlist = getProtectedAccounts();

  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email?.toLowerCase() ?? null;
  const sessionRole = (session?.user as { role?: string } | undefined)?.role;
  if (sessionEmail && sessionRole === 'ADMIN' && allowlist.has(sessionEmail)) {
    return true;
  }

  if (req) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const tokenEmail = (token?.email as string | null | undefined)?.toLowerCase() ?? null;
    if (tokenEmail && token?.role === 'ADMIN' && allowlist.has(tokenEmail)) {
      return true;
    }
  }

  return false;
}
