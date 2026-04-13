import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const bundles = await prisma.bundle.findMany({
    include: { courses: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(bundles);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const { title, description, slug, price, imageUrl, published, courseSlugs } = await req.json();

  if (!title || !slug || !price || !courseSlugs?.length) {
    return NextResponse.json({ error: "Заповніть обов'язкові поля" }, { status: 400 });
  }

  const existing = await prisma.bundle.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "Пакет з таким slug вже існує" }, { status: 400 });
  }

  const bundle = await prisma.bundle.create({
    data: {
      title,
      description: description || null,
      slug,
      price,
      imageUrl: imageUrl || null,
      published: published || false,
      courses: {
        create: courseSlugs.map((courseSlug: string) => ({ courseSlug })),
      },
    },
    include: { courses: true },
  });

  return NextResponse.json(bundle);
}
