import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin } from "@/lib/adminAuth";
import { revalidateLocalized } from "@/lib/revalidatePaths";

type OrderItem = { id: string; rowGroup: number | null };

function parseOrder(raw: unknown): OrderItem[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.every((x) => typeof x === "string")) {
    return (raw as string[]).map((id) => ({ id, rowGroup: null }));
  }
  const out: OrderItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const id = (item as { id?: unknown }).id;
    const rowGroup = (item as { rowGroup?: unknown }).rowGroup;
    if (typeof id !== "string") return null;
    if (rowGroup !== null && rowGroup !== undefined && typeof rowGroup !== "number") return null;
    out.push({ id, rowGroup: typeof rowGroup === "number" ? rowGroup : null });
  }
  return out;
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const body = await req.json();
  const items = parseOrder(body?.order);

  if (!items) {
    return NextResponse.json(
      { error: "order має бути масивом id або {id, rowGroup}" },
      { status: 400 },
    );
  }

  await prisma.$transaction(
    items.map((item, index) =>
      prisma.bundle.update({
        where: { id: item.id },
        data: { sortOrder: index, rowGroup: item.rowGroup },
      }),
    ),
  );

  revalidateLocalized('/courses');
  return NextResponse.json({ ok: true });
}
