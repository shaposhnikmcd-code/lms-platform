import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin } from "@/lib/adminAuth";
import { revalidatePath } from "next/cache";

// POST /api/admin/news/page-content/archive/[id]
//   body: { action: "load" | "restore" }
//
// load    — копіює архівну версію у staged-копію NewsPage (nextContent тощо).
//           Менеджер далі редагує її у /page-builder/next і вирішує коли публікувати.
// restore — повертає архівну версію в LIVE (з підтвердженням). Поточна live
//           додається в архів — повертатись завжди є до чого.

const KEY = "default";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  if (action !== "load" && action !== "restore") {
    return NextResponse.json({ error: "action має бути 'load' або 'restore'" }, { status: 400 });
  }

  const entry = await prisma.newsPageArchive.findUnique({ where: { id } });
  if (!entry || entry.pageKey !== KEY) {
    return NextResponse.json({ error: "Архівну версію не знайдено" }, { status: 404 });
  }

  if (action === "load") {
    // Кладемо у staged — менеджер далі редагує і вирішує коли публікувати.
    await prisma.newsPage.upsert({
      where: { key: KEY },
      update: {
        nextContent: entry.content,
        nextContentEn: entry.contentEn,
        nextContentPl: entry.contentPl,
        nextPageBgColor: entry.pageBgColor,
        nextPageWidth: entry.pageWidth,
        nextPublishAt: null,
        nextUpdatedAt: new Date(),
      },
      create: {
        key: KEY,
        content: "",
        published: false,
        nextContent: entry.content,
        nextContentEn: entry.contentEn,
        nextContentPl: entry.contentPl,
        nextPageBgColor: entry.pageBgColor,
        nextPageWidth: entry.pageWidth,
        nextPublishAt: null,
        nextUpdatedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true, action: "load" });
  }

  // restore — заміна live. Поточну live архівуємо (як при звичайній публікації).
  const page = await prisma.newsPage.findUnique({ where: { key: KEY } });
  const now = new Date();
  const hasLiveContent = page
    && page.content && page.content.trim().length > 0 && page.content !== "[]";

  await prisma.$transaction(async tx => {
    if (page && hasLiveContent) {
      await tx.newsPageArchive.create({
        data: {
          pageKey: KEY,
          content: page.content,
          contentEn: page.contentEn,
          contentPl: page.contentPl,
          pageBgColor: page.pageBgColor,
          pageWidth: page.pageWidth,
          wasPublished: page.published,
          archivedAt: now,
        },
      });
    }
    await tx.newsPage.upsert({
      where: { key: KEY },
      update: {
        content: entry.content,
        contentEn: entry.contentEn,
        contentPl: entry.contentPl,
        pageBgColor: entry.pageBgColor,
        pageWidth: entry.pageWidth,
      },
      create: {
        key: KEY,
        content: entry.content,
        contentEn: entry.contentEn,
        contentPl: entry.contentPl,
        pageBgColor: entry.pageBgColor,
        pageWidth: entry.pageWidth,
        published: false,
      },
    });
    // Архівну використано як live — видаляємо її з архіву (інакше дублює live).
    await tx.newsPageArchive.delete({ where: { id: entry.id } });
  });

  try {
    revalidatePath("/uk/news"); revalidatePath("/en/news"); revalidatePath("/pl/news"); revalidatePath("/news");
  } catch { /* ignore */ }

  return NextResponse.json({ ok: true, action: "restore" });
}
