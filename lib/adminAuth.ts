import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";

export type AdminActor = {
  id?: string;
  name?: string | null;
  email?: string | null;
};

export async function isAdmin(req: NextRequest): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (session?.user?.role === "ADMIN") return true;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  return token?.role === "ADMIN";
}

export async function getAdminActor(req: NextRequest): Promise<AdminActor | null> {
  const session = await getServerSession(authOptions);
  if (session?.user && (session.user as { role?: string }).role === "ADMIN") {
    return {
      id: (session.user as { id?: string }).id,
      name: session.user.name ?? null,
      email: session.user.email ?? null,
    };
  }
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (token?.role === "ADMIN") {
    return {
      id: token.id as string | undefined,
      name: (token.name as string | null | undefined) ?? null,
      email: (token.email as string | null | undefined) ?? null,
    };
  }
  return null;
}

/// Ідентичність співробітника з роллю ADMIN **або** MANAGER.
///
/// `isAdmin`/`getAdminActor` свідомо вужчі — більшість адмін-дій менеджеру закриті.
/// Але частина рутини (Vision-статус, нотатки, видача персонального посилання на
/// оплату модуля) — це саме його щоденна робота, і дублювати «дзеркало getAdminActor
/// для MANAGER» у кожному роуті вже не варто.
export async function getStaffActor(
  req: NextRequest,
): Promise<{ actor: AdminActor; role: "ADMIN" | "MANAGER" } | null> {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as
    { id?: string; role?: string; name?: string | null; email?: string | null } | undefined;
  if (sessionUser?.role === "ADMIN" || sessionUser?.role === "MANAGER") {
    return {
      actor: { id: sessionUser.id, name: sessionUser.name ?? null, email: sessionUser.email ?? null },
      role: sessionUser.role,
    };
  }
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (token?.role === "ADMIN" || token?.role === "MANAGER") {
    return {
      actor: {
        id: token.id as string | undefined,
        name: (token.name as string | null | undefined) ?? null,
        email: (token.email as string | null | undefined) ?? null,
      },
      role: token.role as "ADMIN" | "MANAGER",
    };
  }
  return null;
}
