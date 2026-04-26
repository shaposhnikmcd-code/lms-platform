/// Admin-guard для сертифікатних route-handler-ів. Патерн скопійовано з
/// `app/api/admin/users/route.ts` (NextAuth session + JWT fallback). Винесено в lib
/// бо маршрутів у фічі багато і копіювати було б шумно.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '@/lib/auth';

export type AdminActor = {
  id?: string;
  name?: string | null;
  email?: string | null;
};

export type AdminGuardResult =
  | { ok: true; actor: AdminActor }
  | { ok: false; response: NextResponse };

export async function requireAdmin(req: NextRequest): Promise<AdminGuardResult> {
  const session = await getServerSession(authOptions);
  if (session?.user && (session.user as { role?: string }).role === 'ADMIN') {
    return {
      ok: true,
      actor: {
        id: (session.user as { id?: string }).id,
        name: session.user.name ?? null,
        email: session.user.email ?? null,
      },
    };
  }
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (token?.role === 'ADMIN') {
    return {
      ok: true,
      actor: {
        id: token.id as string | undefined,
        name: (token.name as string | null | undefined) ?? null,
        email: (token.email as string | null | undefined) ?? null,
      },
    };
  }
  return {
    ok: false,
    response: NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 }),
  };
}
