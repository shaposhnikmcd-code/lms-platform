import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin } from "@/lib/adminAuth";
import { revalidateLocalized } from "@/lib/revalidatePaths";

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const body = await req.json();
  const order = body?.order as unknown;

  if (!Array.isArray(order) || order.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "order має бути масивом id" }, { status: 400 });
  }

  const ids = order as string[];

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.bundle.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );

  revalidateLocalized('/courses');
  return NextResponse.json({ ok: true });
}
