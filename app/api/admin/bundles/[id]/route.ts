import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin } from "@/lib/adminAuth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin(req))) {
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
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const { id } = await params;
  const { title, slug, price, imageUrl, published, courseSlugs, suspendedAt, resumeAt } = await req.json();

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
      ...(slug !== undefined && { slug }),
      ...(price !== undefined && { price }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(published !== undefined && { published }),
      ...(suspendedAt !== undefined && { suspendedAt: suspendedAt ? new Date(suspendedAt) : null }),
      ...(resumeAt !== undefined && { resumeAt: resumeAt ? new Date(resumeAt) : null }),
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
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const { id } = await params;

  await prisma.bundle.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
