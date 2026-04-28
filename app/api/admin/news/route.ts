import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { translateNewsAllLocales } from "@/lib/translateNews";
import { getAdminActor, isAdmin } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const news = await prisma.news.findMany({
    orderBy: { createdAt: "desc" },
    include: { author: { select: { name: true } } },
  });

  return NextResponse.json(news);
}

export async function POST(req: NextRequest) {
  const actor = await getAdminActor(req);
  if (!actor) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const { title, slug, content, excerpt, imageUrl, category, published, pageBgColor } = await req.json();

  if (!title || !slug || !content) {
    return NextResponse.json({ error: "Невірні дані" }, { status: 400 });
  }

  const user = actor.email
    ? await prisma.user.findUnique({ where: { email: actor.email } })
    : null;

  const translations = await translateNewsAllLocales({ title, excerpt, content });

  try {
    const item = await prisma.news.create({
      data: {
        title,
        slug,
        content,
        excerpt: excerpt || null,
        imageUrl: imageUrl || null,
        pageBgColor: pageBgColor || null,
        category: category || "NEWS",
        published: published || false,
        authorId: user?.id || null,
        ...translations,
      },
    });
    return NextResponse.json(item);
  } catch (e) {
    // P2002 — unique constraint violation. Найчастіша причина — дублікат slug.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const targets = (e.meta?.target as string[] | undefined) || [];
      if (targets.includes("slug")) {
        // Показуємо ЯКА саме новина блокує цей slug — інакше юзер не може зрозуміти,
        // куди дивитись (slug не показується у згорнутих картках адмін-списку).
        const existing = await prisma.news.findUnique({
          where: { slug },
          select: { title: true, id: true },
        });
        const ref = existing
          ? `Slug "${slug}" уже використовується новиною «${existing.title}». Змініть slug.`
          : `Slug "${slug}" уже зайнятий. Змініть slug.`;
        return NextResponse.json({ error: ref }, { status: 409 });
      }
      return NextResponse.json(
        { error: `Новина з таким значенням уже існує (${targets.join(", ") || "поле"}).` },
        { status: 409 }
      );
    }
    console.error("[POST /api/admin/news] failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Помилка збереження" },
      { status: 500 }
    );
  }
}
