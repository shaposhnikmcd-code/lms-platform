import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin } from "@/lib/adminAuth";
import { revalidatePath } from "next/cache";
import { translateNewsContent } from "@/lib/translate";

// API для білдера сторінки /news.
//   GET   — повертає поточний layout (singleton key="default") або null якщо ще не створено.
//   PATCH — створює/оновлює layout. Body: { content, contentEn?, contentPl?, pageBgColor? }.
//
// Не плутати з /api/admin/news/[id] — той працює зі статтями, а цей з блоками сторінки-списку.

const KEY = "default";

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }
  const page = await prisma.newsPage.findUnique({ where: { key: KEY } });
  return NextResponse.json(page);
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const body = await req.json();
  // PATCH підтримує два режими:
  //  1) Повне оновлення layout-а (з білдера) — body містить content/pageBgColor.
  //  2) Тільки toggle published — body має ТІЛЬКИ {published}; решта полів не чіпаємо.
  const isPublishOnly =
    body && typeof body === "object" &&
    typeof body.published === "boolean" &&
    body.content === undefined;

  if (isPublishOnly) {
    const updated = await prisma.newsPage.upsert({
      where: { key: KEY },
      update: { published: body.published },
      // Якщо запису ще немає — створюємо порожній з обраним статусом (рідкісний кейс).
      create: { key: KEY, content: "", published: body.published },
    });
    try { revalidatePath("/uk/news"); revalidatePath("/en/news"); revalidatePath("/pl/news"); revalidatePath("/news"); } catch {}
    return NextResponse.json(updated);
  }

  const content = typeof body.content === "string" ? body.content : "";
  const pageBgColor = typeof body.pageBgColor === "string" ? body.pageBgColor : null;
  // Якщо клієнт явно передав contentEn/contentPl — поважаємо їх (manual override).
  // Інакше прокачуємо через DeepL — щоб /en/news і /pl/news показували перекладені блоки
  // замість оригіналу. Помилки swallow-имо, fallback на UA-оригінал у render-логіці.
  let contentEn = typeof body.contentEn === "string" ? body.contentEn : null;
  let contentPl = typeof body.contentPl === "string" ? body.contentPl : null;
  if (content && contentEn === null && contentPl === null) {
    try {
      [contentEn, contentPl] = await Promise.all([
        translateNewsContent(content, "en"),
        translateNewsContent(content, "pl"),
      ]);
    } catch (e) {
      console.error("[PATCH /api/admin/news/page-content] translation failed:", e);
    }
  }
  const published = typeof body.published === "boolean" ? body.published : undefined;

  const updated = await prisma.newsPage.upsert({
    where: { key: KEY },
    update: {
      content, pageBgColor, contentEn, contentPl,
      ...(published !== undefined ? { published } : {}),
    },
    create: {
      key: KEY, content, pageBgColor, contentEn, contentPl,
      published: published ?? false,
    },
  });

  // Інвалідуємо ISR-кеш /news і всіх локалізованих варіантів.
  try {
    revalidatePath("/uk/news");
    revalidatePath("/en/news");
    revalidatePath("/pl/news");
    revalidatePath("/news");
  } catch {
    /* revalidatePath не повинен валити мутацію */
  }

  return NextResponse.json(updated);
}
