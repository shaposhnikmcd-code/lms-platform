import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin } from "@/lib/adminAuth";

// GET — список архівних версій сторінки /news (метадані без важкого content).
//   ?id=<archiveId> — повертає повний snapshot для preview-модалки.
//
// Архів формується автоматично в `lib/newsPagePublish.ts` перед заміною live
// версії новою. Створення/видалення вручну не передбачено.

const KEY = "default";

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const entry = await prisma.newsPageArchive.findUnique({ where: { id } });
    if (!entry || entry.pageKey !== KEY) {
      return NextResponse.json({ error: "Не знайдено" }, { status: 404 });
    }
    return NextResponse.json({
      id: entry.id,
      content: entry.content,
      pageBgColor: entry.pageBgColor,
      pageWidth: entry.pageWidth,
      wasPublished: entry.wasPublished,
      archivedAt: entry.archivedAt.toISOString(),
    });
  }

  // Метадані без важкого `content` (кожен snapshot — повний layout сторінки,
  // десятки КБ). `take: 50` обмежує payload — архів росте безмежно, а список
  // показує лише останні версії; повний content тягнеться лише по `?id=` для
  // preview-модалки. `contentLength` прибрано — у UI не використовувався.
  const list = await prisma.newsPageArchive.findMany({
    where: { pageKey: KEY },
    orderBy: { archivedAt: "desc" },
    take: 50,
    select: {
      id: true,
      wasPublished: true,
      archivedAt: true,
    },
  });

  return NextResponse.json(list.map(e => ({
    id: e.id,
    wasPublished: e.wasPublished,
    archivedAt: e.archivedAt.toISOString(),
  })));
}
