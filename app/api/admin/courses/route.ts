import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const { title, description, price, slug, imageUrl, published } = await req.json();

  if (!title || !description || !price) {
    return NextResponse.json({ error: "Невірні дані" }, { status: 400 });
  }

  const course = await prisma.course.create({
    data: {
      title,
      description,
      price,
      slug: slug || null,
      imageUrl: imageUrl || null,
      published: published || false,
    },
  });

  return NextResponse.json(course);
}