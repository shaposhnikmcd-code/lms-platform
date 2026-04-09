import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import type { NextRequest } from "next/server";

// Dynamically set NEXTAUTH_URL from request host so the same deployment
// can serve multiple domains (e.g. www.uimp.com.ua and pre.uimp.com.ua).
async function handler(req: NextRequest, ctx: { params: Promise<{ nextauth: string[] }> }) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) {
    process.env.NEXTAUTH_URL = `${proto}://${host}`;
  }
  return NextAuth(authOptions)(req as unknown as Request, ctx as unknown as { params: { nextauth: string[] } });
}

export { handler as GET, handler as POST };
