import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '@/lib/auth';

/// Список super-admin email-ів читається з env `SUPER_ADMIN_EMAILS` (comma-separated,
/// case-insensitive). Super-admin — це ADMIN з додатковими правами на rare-операції
/// (напр. відмінити запуск cohort-у). Якщо env не виставлено або пусте — права не
/// видаються нікому (повернеться false).
///
/// Чому env, а не DB-роль: у нас один super-admin (власник проєкту), потреба в UI
/// для керування списком відсутня. Vercel env шифрований, аудит зміни є. Якщо
/// згодом super-admin-ів стане ≥3 — варто перевести на DB-роль або boolean-поле.
function getSuperAdminEmails(): Set<string> {
  const raw = process.env.SUPER_ADMIN_EMAILS ?? '';
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/// Перевіряє чи поточний користувач — super-admin.
/// Працює і в API routes (з `req`), і в server components (без `req` — через
/// `getServerSession`, що читає cookies автоматично).
/// Гарантовано вимагає role === 'ADMIN' (super-admin = admin++, не bypass).
export async function isSuperAdmin(req?: NextRequest): Promise<boolean> {
  const allowlist = getSuperAdminEmails();
  if (allowlist.size === 0) return false;

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
