import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin } from "@/lib/adminAuth";
import { syncCatalogCourses } from "@/lib/syncCatalogCourses";

// Read-only endpoint for the bundle builder.
// Source of truth for course metadata is `lib/coursesCatalog.ts` —
// `syncCatalogCourses()` upserts catalog entries into the DB before we read.
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  await syncCatalogCourses();

  const rows = await prisma.course.findMany({
    select: { id: true, slug: true, title: true, price: true, published: true },
    orderBy: { createdAt: "asc" },
  });

  // Legacy data: some courses have slug=null with id storing the slug-like string.
  const courses = rows.map((c) => ({
    id: c.id,
    slug: c.slug ?? c.id,
    title: c.title,
    price: c.price,
    published: c.published,
  }));

  return NextResponse.json(courses);
}
