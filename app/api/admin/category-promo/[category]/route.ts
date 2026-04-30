import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getAdminActor } from "@/lib/adminAuth";
import { revalidateLocalized } from "@/lib/revalidatePaths";
import type { AdminActor } from "@/lib/adminAuth";

const ALLOWED_CATEGORIES = new Set(["bundle", "connector", "yearly", "monthly"]);

type ChangesMap = Record<string, { old: unknown; new: unknown }>;

async function writeAudit(
  category: string,
  actor: AdminActor,
  action: "update" | "reset",
  changes: ChangesMap,
) {
  if (Object.keys(changes).length === 0) return;
  await prisma.coursePriceAuditLog.create({
    data: {
      slug: `category:${category}`,
      userId: actor.id ?? null,
      userEmail: actor.email ?? null,
      userName: actor.name ?? null,
      action,
      changes: changes as Prisma.InputJsonValue,
    },
  });
}

function diffField<T>(name: string, oldVal: T, newVal: T, changes: ChangesMap) {
  const a = oldVal ?? null;
  const b = newVal ?? null;
  if (a === b) return;
  changes[name] = { old: a, new: b };
}

function parsePrice(raw: unknown): number | null | "invalid" {
  if (raw === null || raw === "" || raw === undefined) return null;
  const num = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) return "invalid";
  return num;
}

function parsePromoCode(raw: unknown): string | null | "invalid" {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (trimmed === "") return null;
  if (!/^[A-Za-z0-9_-]{2,32}$/.test(trimmed)) return "invalid";
  return trimmed.toUpperCase();
}

function parseDate(raw: unknown): Date | null | "invalid" {
  if (raw === null || raw === undefined || raw === "") return null;
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return "invalid";
  return d;
}

function sameDate(a: Date | null, b: Date | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.getTime() === b.getTime();
}

function diffDateField(
  name: string,
  oldVal: Date | null,
  newVal: Date | null,
  changes: ChangesMap,
) {
  if (sameDate(oldVal, newVal)) return;
  changes[name] = {
    old: oldVal ? oldVal.toISOString() : null,
    new: newVal ? newVal.toISOString() : null,
  };
}

function revalidateForCategory(category: string) {
  if (category === "bundle") {
    revalidateLocalized("/courses");
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ category: string }> },
) {
  const actor = await getAdminActor(req);
  if (!actor) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const { category } = await params;
  if (!ALLOWED_CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Невідома категорія" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body ?? {}, k);

  const before = await prisma.categoryPromoOverride.findUnique({ where: { category } });

  const promo1Code = has("promo1Code")
    ? parsePromoCode(body.promo1Code)
    : (before?.promo1Code ?? null);
  const promo1Price = has("promo1Price")
    ? parsePrice(body.promo1Price)
    : (before?.promo1Price ?? null);
  const promo1StartsAt = has("promo1StartsAt")
    ? parseDate(body.promo1StartsAt)
    : (before?.promo1StartsAt ?? null);
  const promo1ExpiresAt = has("promo1ExpiresAt")
    ? parseDate(body.promo1ExpiresAt)
    : (before?.promo1ExpiresAt ?? null);

  if (promo1Price === "invalid") {
    return NextResponse.json({ error: "Ціна має бути цілим числом ≥ 0" }, { status: 400 });
  }
  if (promo1Code === "invalid") {
    return NextResponse.json(
      { error: "Промокод має бути 2–32 символи (латиниця, цифри, - та _)" },
      { status: 400 },
    );
  }
  if (promo1StartsAt === "invalid" || promo1ExpiresAt === "invalid") {
    return NextResponse.json({ error: "Невалідна дата дії промокоду" }, { status: 400 });
  }

  if ((promo1Code === null) !== (promo1Price === null)) {
    return NextResponse.json(
      { error: "Заповніть і код, і ціну (або очистіть обидва)" },
      { status: 400 },
    );
  }
  if (
    promo1StartsAt &&
    promo1ExpiresAt &&
    promo1StartsAt.getTime() >= promo1ExpiresAt.getTime()
  ) {
    return NextResponse.json(
      { error: "Дата початку має бути раніше за дату завершення" },
      { status: 400 },
    );
  }
  if (promo1Code === null && (promo1StartsAt !== null || promo1ExpiresAt !== null)) {
    return NextResponse.json(
      { error: "Не можна задавати таймер без промокоду" },
      { status: 400 },
    );
  }

  const allNull =
    promo1Code === null &&
    promo1Price === null &&
    promo1StartsAt === null &&
    promo1ExpiresAt === null;
  if (allNull) {
    if (before) {
      await prisma.categoryPromoOverride.delete({ where: { category } });
      const changes: ChangesMap = {};
      diffField("promo1Code", before.promo1Code, null, changes);
      diffField("promo1Price", before.promo1Price, null, changes);
      diffDateField("promo1StartsAt", before.promo1StartsAt ?? null, null, changes);
      diffDateField("promo1ExpiresAt", before.promo1ExpiresAt ?? null, null, changes);
      await writeAudit(category, actor, "update", changes);
    }
    revalidateForCategory(category);
    return NextResponse.json({ ok: true, cleared: true });
  }

  const override = await prisma.categoryPromoOverride.upsert({
    where: { category },
    create: { category, promo1Code, promo1Price, promo1StartsAt, promo1ExpiresAt },
    update: { promo1Code, promo1Price, promo1StartsAt, promo1ExpiresAt },
  });

  const changes: ChangesMap = {};
  diffField("promo1Code", before?.promo1Code ?? null, promo1Code, changes);
  diffField("promo1Price", before?.promo1Price ?? null, promo1Price, changes);
  diffDateField("promo1StartsAt", before?.promo1StartsAt ?? null, promo1StartsAt, changes);
  diffDateField("promo1ExpiresAt", before?.promo1ExpiresAt ?? null, promo1ExpiresAt, changes);
  await writeAudit(category, actor, "update", changes);

  revalidateForCategory(category);
  return NextResponse.json(override);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ category: string }> },
) {
  const actor = await getAdminActor(req);
  if (!actor) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const { category } = await params;
  if (!ALLOWED_CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Невідома категорія" }, { status: 400 });
  }

  const before = await prisma.categoryPromoOverride.findUnique({ where: { category } });
  await prisma.categoryPromoOverride.deleteMany({ where: { category } });

  if (before) {
    const changes: ChangesMap = {};
    diffField("promo1Code", before.promo1Code, null, changes);
    diffField("promo1Price", before.promo1Price, null, changes);
    diffDateField("promo1StartsAt", before.promo1StartsAt ?? null, null, changes);
    diffDateField("promo1ExpiresAt", before.promo1ExpiresAt ?? null, null, changes);
    await writeAudit(category, actor, "reset", changes);
  }

  revalidateForCategory(category);
  return NextResponse.json({ ok: true });
}
