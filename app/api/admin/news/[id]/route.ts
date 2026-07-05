import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { translateNewsAllLocales } from "@/lib/translateNews";
import { isAdmin } from "@/lib/adminAuth";
import { findUnfilledPlaceholders } from "@/lib/news/placeholderCheck";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const { id } = await params;

  const item = await prisma.news.findUnique({
    where: { id },
    include: { author: { select: { name: true } } },
  });

  if (!item) return NextResponse.json({ error: "Не знайдено" }, { status: 404 });

  return NextResponse.json(item);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const { id } = await params;
  const data = await req.json();

  // Гард на публікацію новин зі шаблону: якщо новина переводиться в published,
  // або просто переходить через published-стан, забороняємо зберігати з
  // плейсхолдерами "[Назва події]" / "<p>Заголовок</p>" — інакше менеджер
  // випадково публікує template-«рибу» на /news. Перевіряємо ефективний стан
  // після PATCH (data поверх існуючого).
  // Заходимо в гейт не лише при переході в published, а й коли редагують
  // content-поля (templateBlocks/templateData/content) — інакше редагування
  // ВЖЕ опублікованої новини з новими плейсхолдерами обходило перевірку і
  // «риба» йшла на /news (effectivePublished нижче = current.published).
  const editsContent =
    "templateBlocks" in data || "templateData" in data || "content" in data;
  if (data.published === true || data.isTemplate === false || editsContent) {
    const current = await prisma.news.findUnique({
      where: { id },
      select: { published: true, templateData: true, templateBlocks: true, isTemplate: true },
    });
    if (current && !(data.isTemplate ?? current.isTemplate)) {
      const effectivePublished = data.published ?? current.published;
      if (effectivePublished) {
        const td = data.templateData ?? current.templateData;
        const tb = data.templateBlocks ?? current.templateBlocks;
        const issues = findUnfilledPlaceholders(td, tb);
        if (issues.length > 0) {
          const samples = issues.slice(0, 3).map(i => `«${i.sample}»`).join(", ");
          return NextResponse.json(
            {
              error: `Не можу опублікувати — у новині залишились незаповнені плейсхолдери шаблону: ${samples}. Заповніть поля у формі-редакторі.`,
              code: "UNFILLED_PLACEHOLDERS",
              issues,
            },
            { status: 422 }
          );
        }
      }
    }
  }

  // Re-run DeepL translation when title/excerpt/content/previewContent actually changed.
  // PATCH may also be called for tiny edits (publish toggle, image swap) — in
  // that case we leave the existing translations alone to save DeepL quota.
  const needsRetranslate =
    typeof data.title === "string" ||
    typeof data.excerpt === "string" ||
    typeof data.content === "string" ||
    typeof data.previewContent === "string";

  let translations = {};
  if (needsRetranslate) {
    const current = await prisma.news.findUnique({ where: { id } });
    // Шаблони не публікуються — переклади їм не потрібні (та й placeholder-тексти
    // у дужках типу "[Заголовок]" не варто гонити через DeepL).
    if (current && !current.isTemplate) {
      translations = await translateNewsAllLocales({
        title: data.title ?? current.title,
        excerpt: data.excerpt ?? current.excerpt,
        content: data.content ?? current.content,
        previewContent: data.previewContent ?? current.previewContent,
      });
    }
  }

  // Allow-list полів, які клієнт має право змінювати. Раніше сюди спредився весь
  // body (`...data`) — mass-assignment: клієнт міг перезаписати isTemplate,
  // parentTemplateId, templateKind, authorId, id, createdAt чи *En/*Pl-переклади
  // (затерши DeepL-вивід). Пишемо лише безпечні поля; переклади (translations)
  // додаються сервером окремо, suspendedAt/resumeAt — з Date-конверсією нижче.
  const PATCHABLE_FIELDS = [
    "title", "slug", "excerpt", "imageUrl", "category", "pageBgColor",
    "content", "previewContent",
    "templateData", "templateBlocks", "templateCanvas",
    "published", "showAuthorMeta",
  ] as const;
  const patchData: Record<string, unknown> = {};
  for (const k of PATCHABLE_FIELDS) {
    if (k in data) patchData[k] = (data as Record<string, unknown>)[k];
  }
  // Нормалізуємо порожню назву: whitespace-only ("  ") → "" щоб фільтр безіменних
  // чернеток (app/api/admin/news/route.ts) її ловив. Інакше назва з пробілів
  // оминала `title === ""` і фантом-чернетка поверталась у listing.
  if (typeof patchData.title === "string" && patchData.title.trim() === "") {
    patchData.title = "";
  }
  Object.assign(patchData, translations);
  if (data.suspendedAt !== undefined) {
    patchData.suspendedAt = data.suspendedAt ? new Date(data.suspendedAt) : null;
  }
  if (data.resumeAt !== undefined) {
    patchData.resumeAt = data.resumeAt ? new Date(data.resumeAt) : null;
  }

  try {
    const item = await prisma.news.update({
      where: { id },
      data: patchData,
    });
    return NextResponse.json(item);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const targets = (e.meta?.target as string[] | undefined) || [];
      if (targets.includes("slug") && typeof data.slug === "string") {
        const existing = await prisma.news.findFirst({
          where: { slug: data.slug, id: { not: id } },
          select: { title: true, id: true },
        });
        const ref = existing
          ? `Slug "${data.slug}" уже використовується новиною «${existing.title}». Змініть slug.`
          : `Slug "${data.slug}" уже зайнятий. Змініть slug.`;
        return NextResponse.json({ error: ref }, { status: 409 });
      }
      return NextResponse.json(
        { error: `Новина з таким значенням уже існує (${targets.join(", ") || "поле"}).` },
        { status: 409 }
      );
    }
    // P2025 — запис для update не знайдено (видалили паралельно). Це 404,
    // не 500 — клієнт має оновити список, а не бачити «Помилка збереження».
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Новину не знайдено" }, { status: 404 });
    }
    console.error("[PATCH /api/admin/news/" + id + "] failed:", e);
    return NextResponse.json(
      { error: "Помилка збереження" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.news.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2025") {
        return NextResponse.json({ error: "Новину не знайдено (можливо, вже видалена)" }, { status: 404 });
      }
      if (e.code === "P2003") {
        return NextResponse.json({ error: "Не можу видалити — на новину посилається інший запис" }, { status: 409 });
      }
    }
    console.error("[DELETE /api/admin/news/" + id + "] failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Помилка видалення" },
      { status: 500 }
    );
  }
}
