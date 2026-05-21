import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// Діагностика: до якої Neon-БД конектиться поточний деплой.
// Корисно після розділення pre/prod БД — швидко перевірити що pre.uimp
// дивиться у pre-Neon, а uimp.com.ua у prod-Neon.
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const url = process.env.DATABASE_URL ?? "";
  let host = "(unset)";
  let dbName = "(unset)";
  try {
    const u = new URL(url);
    host = u.host;
    dbName = u.pathname.replace(/^\//, "");
  } catch {}

  const known: Record<string, string> = {
    "ep-odd-night-alip82dn": "PROD",
    "ep-sparkling-wave-alq11hyy": "DEV",
  };
  const tag =
    Object.entries(known).find(([h]) => host.includes(h))?.[1] ?? "PRE";

  let userCount = 0;
  let tableCount = 0;
  try {
    userCount = await prisma.user.count();
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;
    tableCount = rows[0]?.count ?? 0;
  } catch (e) {
    return NextResponse.json(
      { host, dbName, tag, error: (e as Error).message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    host,
    dbName,
    tag,
    tables: tableCount,
    users: userCount,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    vercelGitBranch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    nodeEnv: process.env.NODE_ENV,
  });
}
