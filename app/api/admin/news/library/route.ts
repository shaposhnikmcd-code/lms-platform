import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin } from "@/lib/adminAuth";

// Бібліотека новин для правого бару білдера сторінки /news.
// Повертає тільки `published` новини з мінімальним набором полів для drag-карток.
// suspendedAt/resumeAt не фільтруємо тут — це контроль детальної сторінки;
// видимість на /news listing визначається розміщенням блока (з опційним per-block schedule).
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  // isTemplate=false: blueprint-и не для draggable-сайдбара — це лише взірці.
  // Показуємо всі решта новин (published + draft) — у sidebar є бейдж
  // «чернетка», щоб менеджер бачив свою недозавершену роботу і міг
  // розмістити її на сторінці після публікації.
  const items = await prisma.news.findMany({
    where: { isTemplate: false },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,    // потрібно для displayMode=expanded — рендер повного тіла новини інлайн
      previewContent: true, // кастомний layout превʼю-картки (білдер /news/[id]/preview)
      pageBgColor: true,
      published: true,  // для бейджа «чернетка» у sidebar
      templateKind: true, // template-based render у newsCard preview/expanded
      templateData: true,
      templateBlocks: true, // block-based template (Session 3+) — render через AbsoluteBlockRender
      templateCanvas: true,
      imageUrl: true,
      category: true,
      createdAt: true,
      suspendedAt: true,
      resumeAt: true,
      author: { select: { name: true } },
    },
  });

  return NextResponse.json(items);
}
