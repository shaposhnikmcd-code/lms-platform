import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { isAdmin } from "@/lib/adminAuth";
import { COURSES_BY_SLUG } from "@/lib/coursesCatalog";

function revalidateCoursesPages(slug: string) {
  for (const locale of ["uk", "pl", "en"]) {
    try {
      revalidatePath(`/${locale}/courses`);
      revalidatePath(`/${locale}/courses/${slug}`);
    } catch {
    }
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const { slug } = await params;
  if (!slug || !(slug in COURSES_BY_SLUG)) {
    return NextResponse.json({ error: "Невідомий slug курсу" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));

  const parsePrice = (raw: unknown): number | null | "invalid" => {
    if (raw === null || raw === "" || raw === undefined) return null;
    const num = typeof raw === "number" ? raw : Number(String(raw).trim());
    if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) return "invalid";
    return num;
  };

  const price = parsePrice(body?.price);
  const oldPrice = parsePrice(body?.oldPrice);

  if (price === "invalid" || oldPrice === "invalid") {
    return NextResponse.json({ error: "Ціна має бути цілим числом ≥ 0" }, { status: 400 });
  }

  if (price === null && oldPrice === null) {
    await prisma.coursePriceOverride.deleteMany({ where: { slug } });
    revalidateCoursesPages(slug);
    return NextResponse.json({ ok: true, cleared: true });
  }

  const override = await prisma.coursePriceOverride.upsert({
    where: { slug },
    create: { slug, price, oldPrice },
    update: { price, oldPrice },
  });

  revalidateCoursesPages(slug);
  return NextResponse.json(override);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "Відсутній slug" }, { status: 400 });
  }

  await prisma.coursePriceOverride.deleteMany({ where: { slug } });
  revalidateCoursesPages(slug);
  return NextResponse.json({ ok: true });
}
