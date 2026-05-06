import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin } from "@/lib/adminAuth";
import { revalidatePath } from "next/cache";
import { translateNewsContent } from "@/lib/translate";
import { maybeAutoPublishStagedNewsPage } from "@/lib/newsPagePublish";

// API для білдера "Наступної сторінки" /news.
// Live-версія сторінки лишається в /api/admin/news/page-content. Цей роут
// працює виключно зі staged-копією (next* поля моделі NewsPage).
//
// Workflow:
//   1) Менеджер відкриває білдер /next; якщо nextContent ще не існує — клонуємо live як стартову точку.
//   2) Зберігається через PATCH тут, у next*. Live не торкається.
//   3) Менеджер виставляє nextPublishAt → перший хіт на /news (або адмінку)
//      після цього часу автоматично swap-ить через `maybeAutoPublishStagedNewsPage`
//      (read-time pattern, без cron-ів).
//   4) Альтернативно адмін може опублікувати негайно: POST з action="publish-now".
//   5) Скасувати чернетку — DELETE.

const KEY = "default";

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }
  // Якщо таймер уже настав — auto-swap. Адмін побачить що чернетка зникла
  // (вона стала live), staged-секція покаже "немає чернетки".
  await maybeAutoPublishStagedNewsPage();
  const page = await prisma.newsPage.findUnique({ where: { key: KEY } });
  if (!page) return NextResponse.json(null);

  // Якщо staged-копії ще нема — повертаємо live як стартовий стан, щоб білдер
  // відкрився з тим самим контентом і менеджер вносив зміни поверх, а не з нуля.
  // Прапор `hasStaged` дає клієнту знати чи це справжня чернетка чи fallback.
  const hasStaged = page.nextContent !== null;
  return NextResponse.json({
    hasStaged,
    content: page.nextContent ?? page.content,
    contentEn: page.nextContentEn ?? page.contentEn,
    contentPl: page.nextContentPl ?? page.contentPl,
    pageBgColor: page.nextPageBgColor ?? page.pageBgColor,
    publishAt: page.nextPublishAt ? page.nextPublishAt.toISOString() : null,
    nextUpdatedAt: page.nextUpdatedAt ? page.nextUpdatedAt.toISOString() : null,
  });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }
  const body = await req.json();

  // Парсимо publishAt: ISO рядок → Date | null. Невалідне значення → null.
  let publishAt: Date | null = null;
  if (typeof body.publishAt === "string" && body.publishAt) {
    const d = new Date(body.publishAt);
    if (!Number.isNaN(d.getTime())) publishAt = d;
  }

  // Партіальний апдейт (тільки publishAt, без content) — використовується inline-пікером
  // у адмінці щоб менеджер міг швидко змінити дату публікації, не заходячи в білдер.
  // Не торкаємось nextContent/Pl/En/PageBgColor.
  const isScheduleOnly = body.content === undefined;
  if (isScheduleOnly) {
    const existing = await prisma.newsPage.findUnique({ where: { key: KEY } });
    if (!existing || existing.nextContent === null) {
      return NextResponse.json(
        { error: "Чернетки ще нема — спочатку відкрийте білдер 'Наступна сторінка' і збережіть її" },
        { status: 400 },
      );
    }
    await prisma.newsPage.update({
      where: { key: KEY },
      data: { nextPublishAt: publishAt, nextUpdatedAt: new Date() },
    });
    return NextResponse.json({ ok: true, mode: "schedule-only" });
  }

  // Повний апдейт (з content): зберігається з білдера.
  const content = typeof body.content === "string" ? body.content : "";
  const pageBgColor = typeof body.pageBgColor === "string" ? body.pageBgColor : null;

  // DeepL для contentEn/Pl (якщо клієнт їх явно не передав). Помилки swallow-имо
  // — fallback на UA-оригінал у render-логіці.
  let contentEn = typeof body.contentEn === "string" ? body.contentEn : null;
  let contentPl = typeof body.contentPl === "string" ? body.contentPl : null;
  if (content && contentEn === null && contentPl === null) {
    try {
      [contentEn, contentPl] = await Promise.all([
        translateNewsContent(content, "en"),
        translateNewsContent(content, "pl"),
      ]);
    } catch (e) {
      console.error("[PATCH /api/admin/news/page-content/next] translation failed:", e);
    }
  }

  // Live-сторінку має існувати щоб писати staged (інакше відкатуватись нема куди).
  // Якщо запис ще не створено — створюємо порожній, потім patch-имо staged.
  await prisma.newsPage.upsert({
    where: { key: KEY },
    update: {
      nextContent: content,
      nextContentEn: contentEn,
      nextContentPl: contentPl,
      nextPageBgColor: pageBgColor,
      nextPublishAt: publishAt,
      nextUpdatedAt: new Date(),
    },
    create: {
      key: KEY,
      content: "",
      published: false,
      nextContent: content,
      nextContentEn: contentEn,
      nextContentPl: contentPl,
      nextPageBgColor: pageBgColor,
      nextPublishAt: publishAt,
      nextUpdatedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}

// Скасувати staged (повернути сторінку до live без змін).
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }
  await prisma.newsPage.update({
    where: { key: KEY },
    data: {
      nextContent: null,
      nextContentEn: null,
      nextContentPl: null,
      nextPageBgColor: null,
      nextPublishAt: null,
      nextUpdatedAt: null,
    },
  }).catch(() => {/* запису може не існувати — ок */});
  return NextResponse.json({ ok: true });
}

// Опублікувати негайно: копіює next* → live, чистить next*. Реалізація у єдиному
// місці (lib/newsPagePublish) — і ручний клік, і read-time auto-publish ходять
// через ту саму функцію.
export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }
  const { publishStagedNewsPage } = await import("@/lib/newsPagePublish");
  const result = await publishStagedNewsPage();
  if (!result.published) {
    return NextResponse.json({ error: result.reason || "Нічого публікувати" }, { status: 400 });
  }
  try {
    revalidatePath("/uk/news"); revalidatePath("/en/news"); revalidatePath("/pl/news"); revalidatePath("/news");
  } catch {/* ignore */}
  return NextResponse.json({ ok: true });
}
