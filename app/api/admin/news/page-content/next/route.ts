import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin } from "@/lib/adminAuth";
import { revalidatePath } from "next/cache";
import { translateNewsContent } from "@/lib/translate";
import { maybeAutoPublishStagedNewsPage } from "@/lib/newsPagePublish";
import {
  KYIV_PUBLISH_HOUR,
  isIsoDate,
  kyivDateAtHourToUTC,
  utcToKyivDateStr,
} from "@/lib/timezone";

// API для білдера "Наступної сторінки" /news.
// Live-версія сторінки лишається в /api/admin/news/page-content. Цей роут
// працює виключно зі staged-копією (next* поля моделі NewsPage).
//
// Workflow:
//   1) Менеджер відкриває білдер /next; якщо nextContent ще не існує — клонуємо live як стартову точку.
//   2) Зберігається через PATCH тут, у next*. Live не торкається.
//   3) Менеджер виставляє `publishOn` (тільки дата YYYY-MM-DD). Бекенд кладе
//      `nextPublishAt = 06:00 Europe/Kyiv` цього дня (UTC). Cron
//      `/api/cron/news-publish` (04:00 UTC ≈ 06:00–07:00 Київ) щоранку
//      робить swap; read-time `maybeAutoPublishStagedNewsPage` лишається
//      як safety-net (тригериться при відвідуванні /news).
//   4) Опублікувати негайно — POST.
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

  // Якщо staged-копії нема — віддаємо порожній канвас, а не клон live.
  // Поведінка очікувана менеджером: «Створити наступну» = чистий аркуш;
  // «Очистити чернетку» → знову чистий аркуш. Якщо потрібно стартувати з
  // копії live-сторінки, це робиться явно (окрема дія, не fallback).
  // Прапор `hasStaged` дає клієнту знати чи це справжня чернетка.
  const hasStaged = page.nextContent !== null;
  return NextResponse.json({
    hasStaged,
    content: page.nextContent ?? "",
    contentEn: page.nextContentEn ?? "",
    contentPl: page.nextContentPl ?? "",
    pageBgColor: page.nextPageBgColor ?? "",
    // `publishOn` — Київ-календарна дата (YYYY-MM-DD). UI працює тільки з нею.
    // `publishAt` — повний UTC-інстант для довідкових рендерів (countdown).
    publishOn: utcToKyivDateStr(page.nextPublishAt),
    publishAt: page.nextPublishAt ? page.nextPublishAt.toISOString() : null,
    nextUpdatedAt: page.nextUpdatedAt ? page.nextUpdatedAt.toISOString() : null,
  });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }
  const body = await req.json();

  // Дата публікації приходить як `publishOn: "YYYY-MM-DD"` (Київ-календарна
  // дата). Бекенд кладе у БД як 06:00 Europe/Kyiv цього дня в UTC. `null`/""
  // → таймер прибрано, чернетка чекає ручної публікації.
  let publishAt: Date | null = null;
  const hasPublishOnKey = Object.prototype.hasOwnProperty.call(body, "publishOn");
  if (hasPublishOnKey) {
    const v = body.publishOn;
    if (v === null || v === "") {
      publishAt = null;
    } else if (isIsoDate(v)) {
      publishAt = kyivDateAtHourToUTC(v, KYIV_PUBLISH_HOUR);
    } else {
      return NextResponse.json(
        { error: "publishOn має бути 'YYYY-MM-DD' або null" },
        { status: 400 },
      );
    }
  }

  // Партіальний апдейт (тільки publishOn, без content) — використовується
  // inline date-пікером у адмінці. Не торкаємось nextContent/Pl/En/PageBgColor.
  const isScheduleOnly = body.content === undefined;
  if (isScheduleOnly) {
    if (!hasPublishOnKey) {
      return NextResponse.json(
        { error: "Очікується publishOn або content" },
        { status: 400 },
      );
    }
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
  // `nextPublishAt` оновлюємо ТІЛЬКИ якщо клієнт явно передав `publishOn` —
  // інакше зберігаємо попередній таймер (білдер може save-ити лише контент).
  const baseUpdate = {
    nextContent: content,
    nextContentEn: contentEn,
    nextContentPl: contentPl,
    nextPageBgColor: pageBgColor,
    nextUpdatedAt: new Date(),
  };
  await prisma.newsPage.upsert({
    where: { key: KEY },
    update: hasPublishOnKey
      ? { ...baseUpdate, nextPublishAt: publishAt }
      : baseUpdate,
    create: {
      key: KEY,
      content: "",
      published: false,
      ...baseUpdate,
      nextPublishAt: hasPublishOnKey ? publishAt : null,
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
