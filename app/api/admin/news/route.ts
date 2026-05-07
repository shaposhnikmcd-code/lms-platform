import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { translateNewsAllLocales } from "@/lib/translateNews";
import { getAdminActor, isAdmin } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  // Slim-select: лише поля, потрібні для списку в адмінці. НЕ тягнемо
  // contentEn/contentPl/previewContent* і не повертаємо сирий content на клієнт —
  // це JSON-блоки на десятки/сотні KB. Парсимо content одразу на сервері і
  // вертаємо тільки firstContentImage (URL) — клієнту лишається легкий payload.
  const rows = await prisma.news.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      imageUrl: true,
      category: true,
      published: true,
      suspendedAt: true,
      resumeAt: true,
      createdAt: true,
      content: true,
      author: { select: { name: true } },
    },
  });

  const slimmed = rows.map(n => {
    let firstContentImage: string | null = null;
    try {
      const parsed = JSON.parse(n.content);
      if (Array.isArray(parsed)) {
        const img = parsed.find((b: { type?: string; data?: { url?: string } }) =>
          b && b.type === "image" && b.data?.url
        );
        if (img && img.data?.url) firstContentImage = img.data.url;
      }
    } catch { /* not JSON or no blocks */ }
    const { content: _content, ...rest } = n;
    void _content;
    return { ...rest, firstContentImage };
  });

  return NextResponse.json(slimmed);
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
        // Видимість на /news диктує білдер (newsCard на сторінці) — UI-toggle
        // `published` прибрано. Новина одразу `published: true`, інакше публічний
        // рендер відфільтрував би її навіть з білдера. Параметр у body
        // лишаємо як override (backward compat для старого UI).
        published: typeof published === "boolean" ? published : true,
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
