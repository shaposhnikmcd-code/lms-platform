import { NextRequest, NextResponse } from "next/server";
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
}
