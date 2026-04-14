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
