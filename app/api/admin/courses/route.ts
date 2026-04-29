import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin } from "@/lib/adminAuth";
import { syncCatalogCourses } from "@/lib/syncCatalogCourses";
import { getCoursePriceOverrides } from "@/lib/coursePrice";

// Read-only endpoint for the bundle builder.
// Single source of truth for current price = admin override (if set) → catalog default.
// Course.price у DB йде як fallback (sync-иться з catalog через syncCatalogCourses).
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  await syncCatalogCourses();

  const [rows, overrides] = await Promise.all([
    prisma.course.findMany({
      select: { id: true, slug: true, title: true, price: true, published: true },
      orderBy: { createdAt: "asc" },
    }),
    getCoursePriceOverrides(),
  ]);

  // Legacy data: some courses have slug=null with id storing the slug-like string.
  const courses = rows.map((c) => {
    const slug = c.slug ?? c.id;
    return {
      id: c.id,
      slug,
      title: c.title,
      price: overrides.get(slug) ?? c.price,
      published: c.published,
    };
  });

  return NextResponse.json(courses);
}
