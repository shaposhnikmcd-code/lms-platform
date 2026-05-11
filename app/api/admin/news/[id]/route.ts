import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { translateNewsAllLocales } from "@/lib/translateNews";
import { isAdmin } from "@/lib/adminAuth";

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

  const patchData: Record<string, unknown> = { ...data, ...translations };
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
    console.error("[PATCH /api/admin/news/" + id + "] failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Помилка збереження" },
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

  await prisma.news.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
