import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const news = await prisma.news.findMany({
    orderBy: { createdAt: "desc" },
    include: { author: { select: { name: true } } },
  });

  return NextResponse.json(news);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const { title, slug, content, excerpt, imageUrl, category, published } = await req.json();

  if (!title || !slug || !content) {
    return NextResponse.json({ error: "Невірні дані" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
  });

  const item = await prisma.news.create({
    data: {
      title,
      slug,
      content,
      excerpt: excerpt || null,
      imageUrl: imageUrl || null,
      category: category || "NEWS",
      published: published || false,
      authorId: user?.id || null,
    },
  });

  return NextResponse.json(item);
}