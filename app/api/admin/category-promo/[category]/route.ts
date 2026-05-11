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

interface PromoSlot {
  code: string | null;
  price: number | null;
  startsAt: Date | null;
  expiresAt: Date | null;
}

/// Парсить один слот промокоду з body, з fallback на before-значення для полів,
/// яких немає в payload (часткові патчі).
function parseSlot(
  body: Record<string, unknown>,
  prefix: "promo1" | "promo2",
  before: PromoSlot,
): PromoSlot | { error: string } {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);

  const codeRaw = has(`${prefix}Code`) ? parsePromoCode(body[`${prefix}Code`]) : before.code;
  const priceRaw = has(`${prefix}Price`) ? parsePrice(body[`${prefix}Price`]) : before.price;
  const startsRaw = has(`${prefix}StartsAt`)
    ? parseDate(body[`${prefix}StartsAt`])
    : before.startsAt;
  const expiresRaw = has(`${prefix}ExpiresAt`)
    ? parseDate(body[`${prefix}ExpiresAt`])
    : before.expiresAt;

  if (priceRaw === "invalid") return { error: "Ціна має бути цілим числом ≥ 0" };
  if (codeRaw === "invalid") {
    return { error: "Промокод має бути 2–32 символи (латиниця, цифри, - та _)" };
  }
  if (startsRaw === "invalid" || expiresRaw === "invalid") {
    return { error: "Невалідна дата дії промокоду" };
  }

  if ((codeRaw === null) !== (priceRaw === null)) {
    return { error: "Заповніть і код, і ціну (або очистіть обидва)" };
  }
  if (startsRaw && expiresRaw && startsRaw.getTime() >= expiresRaw.getTime()) {
    return { error: "Дата початку має бути раніше за дату завершення" };
  }
  if (codeRaw === null && (startsRaw !== null || expiresRaw !== null)) {
    return { error: "Не можна задавати таймер без промокоду" };
  }

  return {
    code: codeRaw,
    price: priceRaw,
    startsAt: startsRaw,
    expiresAt: expiresRaw,
  };
}

function slotIsEmpty(s: PromoSlot): boolean {
  return s.code === null && s.price === null && s.startsAt === null && s.expiresAt === null;
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

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const before = await prisma.categoryPromoOverride.findUnique({ where: { category } });

  const beforeSlot1: PromoSlot = {
    code: before?.promo1Code ?? null,
    price: before?.promo1Price ?? null,
    startsAt: before?.promo1StartsAt ?? null,
    expiresAt: before?.promo1ExpiresAt ?? null,
  };
  const beforeSlot2: PromoSlot = {
    code: before?.promo2Code ?? null,
    price: before?.promo2Price ?? null,
    startsAt: before?.promo2StartsAt ?? null,
    expiresAt: before?.promo2ExpiresAt ?? null,
  };

  const slot1 = parseSlot(body, "promo1", beforeSlot1);
  if ("error" in slot1) return NextResponse.json({ error: slot1.error }, { status: 400 });
  const slot2 = parseSlot(body, "promo2", beforeSlot2);
  if ("error" in slot2) return NextResponse.json({ error: slot2.error }, { status: 400 });

  if (slot1.code && slot2.code && slot1.code === slot2.code) {
    return NextResponse.json(
      { error: "Промокод 1 і Промокод 2 не можуть співпадати" },
      { status: 400 },
    );
  }

  const allEmpty = slotIsEmpty(slot1) && slotIsEmpty(slot2);
  if (allEmpty) {
    if (before) {
      await prisma.categoryPromoOverride.delete({ where: { category } });
      const changes: ChangesMap = {};
      diffField("promo1Code", beforeSlot1.code, null, changes);
      diffField("promo1Price", beforeSlot1.price, null, changes);
      diffDateField("promo1StartsAt", beforeSlot1.startsAt, null, changes);
      diffDateField("promo1ExpiresAt", beforeSlot1.expiresAt, null, changes);
      diffField("promo2Code", beforeSlot2.code, null, changes);
      diffField("promo2Price", beforeSlot2.price, null, changes);
      diffDateField("promo2StartsAt", beforeSlot2.startsAt, null, changes);
      diffDateField("promo2ExpiresAt", beforeSlot2.expiresAt, null, changes);
      await writeAudit(category, actor, "update", changes);
    }
    revalidateForCategory(category);
    return NextResponse.json({ ok: true, cleared: true });
  }

  const data = {
    promo1Code: slot1.code,
    promo1Price: slot1.price,
    promo1StartsAt: slot1.startsAt,
    promo1ExpiresAt: slot1.expiresAt,
    promo2Code: slot2.code,
    promo2Price: slot2.price,
    promo2StartsAt: slot2.startsAt,
    promo2ExpiresAt: slot2.expiresAt,
  };

  const override = await prisma.categoryPromoOverride.upsert({
    where: { category },
    create: { category, ...data },
    update: data,
  });

  const changes: ChangesMap = {};
  diffField("promo1Code", beforeSlot1.code, slot1.code, changes);
  diffField("promo1Price", beforeSlot1.price, slot1.price, changes);
  diffDateField("promo1StartsAt", beforeSlot1.startsAt, slot1.startsAt, changes);
  diffDateField("promo1ExpiresAt", beforeSlot1.expiresAt, slot1.expiresAt, changes);
  diffField("promo2Code", beforeSlot2.code, slot2.code, changes);
  diffField("promo2Price", beforeSlot2.price, slot2.price, changes);
  diffDateField("promo2StartsAt", beforeSlot2.startsAt, slot2.startsAt, changes);
  diffDateField("promo2ExpiresAt", beforeSlot2.expiresAt, slot2.expiresAt, changes);
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
    diffField("promo2Code", before.promo2Code, null, changes);
    diffField("promo2Price", before.promo2Price, null, changes);
    diffDateField("promo2StartsAt", before.promo2StartsAt ?? null, null, changes);
    diffDateField("promo2ExpiresAt", before.promo2ExpiresAt ?? null, null, changes);
    await writeAudit(category, actor, "reset", changes);
  }

  revalidateForCategory(category);
  return NextResponse.json({ ok: true });
}
