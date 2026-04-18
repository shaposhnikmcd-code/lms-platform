import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin } from "@/lib/adminAuth";
import { revalidateLocalized } from "@/lib/revalidatePaths";

function normalizeNullable(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function revalidateConsultations() {
  revalidateLocalized('/consultations');
}

export async function PATCH(
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

  const body = await req.json().catch(() => ({}));
  const { price, duration, btnLabel, btnUrl, hidden } = body ?? {};

  const data: Record<string, unknown> = {};
  const p = normalizeNullable(price);
  const d = normalizeNullable(duration);
  const bl = normalizeNullable(btnLabel);
  const bu = normalizeNullable(btnUrl);
  if (p !== undefined) data.price = p;
  if (d !== undefined) data.duration = d;
  if (bl !== undefined) data.btnLabel = bl;
  if (bu !== undefined) data.btnUrl = bu;
  if (typeof hidden === "boolean") data.hidden = hidden;

  const override = await prisma.specialistOverride.upsert({
    where: { slug },
    create: {
      slug,
      price: (data.price as string | null | undefined) ?? null,
      duration: (data.duration as string | null | undefined) ?? null,
      btnLabel: (data.btnLabel as string | null | undefined) ?? null,
      btnUrl: (data.btnUrl as string | null | undefined) ?? null,
      hidden: (data.hidden as boolean | undefined) ?? false,
    },
    update: data,
  });

  revalidateConsultations();
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

  await prisma.specialistOverride.deleteMany({ where: { slug } });
  revalidateConsultations();
  return NextResponse.json({ ok: true });
}
