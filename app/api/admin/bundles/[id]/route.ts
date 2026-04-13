import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const { id } = await params;

  const bundle = await prisma.bundle.findUnique({
    where: { id },
    include: { courses: true },
  });

  if (!bundle) {
    return NextResponse.json({ error: "Пакет не знайдено" }, { status: 404 });
  }

  return NextResponse.json(bundle);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const { id } = await params;
  const { title, description, slug, price, imageUrl, published, courseSlugs } = await req.json();

  // Check slug uniqueness if changed
  if (slug) {
    const existing = await prisma.bundle.findFirst({
      where: { slug, NOT: { id } },
    });
    if (existing) {
      return NextResponse.json({ error: "Пакет з таким slug вже існує" }, { status: 400 });
    }
  }

  const bundle = await prisma.bundle.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(slug !== undefined && { slug }),
      ...(price !== undefined && { price }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(published !== undefined && { published }),
    },
  });

  // Update courses if provided
  if (courseSlugs) {
    await prisma.bundleCourse.deleteMany({ where: { bundleId: id } });
    await prisma.bundleCourse.createMany({
      data: courseSlugs.map((courseSlug: string) => ({
        bundleId: id,
        courseSlug,
      })),
    });
  }

  const updated = await prisma.bundle.findUnique({
    where: { id },
    include: { courses: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const { id } = await params;

  await prisma.bundle.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
