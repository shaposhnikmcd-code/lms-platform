import { NextRequest, NextResponse } from "next/server";
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

  // Re-run DeepL translation when title/excerpt/content actually changed.
  // PATCH may also be called for tiny edits (publish toggle, image swap) — in
  // that case we leave the existing translations alone to save DeepL quota.
  const needsRetranslate =
    typeof data.title === "string" ||
    typeof data.excerpt === "string" ||
    typeof data.content === "string";

  let translations = {};
  if (needsRetranslate) {
    const current = await prisma.news.findUnique({ where: { id } });
    if (current) {
      translations = await translateNewsAllLocales({
        title: data.title ?? current.title,
        excerpt: data.excerpt ?? current.excerpt,
        content: data.content ?? current.content,
      });
    }
  }

  const item = await prisma.news.update({
    where: { id },
    data: { ...data, ...translations },
  });

  return NextResponse.json(item);
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
