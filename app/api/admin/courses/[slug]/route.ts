import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getAdminActor } from "@/lib/adminAuth";
import { COURSES_BY_SLUG } from "@/lib/coursesCatalog";
import { recalcAutoPricedBundlesForCourse } from "@/lib/coursePrice";
import { revalidateLocalized } from "@/lib/revalidatePaths";
import type { AdminActor } from "@/lib/adminAuth";

function revalidateCoursesPages(slug: string) {
  revalidateLocalized('/courses');
  revalidateLocalized(`/courses/${slug}`);
}

type ChangesMap = Record<string, { old: unknown; new: unknown }>;

async function writeAudit(
  slug: string,
  actor: AdminActor,
  action: "update" | "reset",
  changes: ChangesMap,
) {
  if (Object.keys(changes).length === 0) return;
  await prisma.coursePriceAuditLog.create({
    data: {
      slug,
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
  // Дозволяємо латиницю, цифри, дефіс і підкреслення; 2..32 символи.
  if (!/^[A-Za-z0-9_-]{2,32}$/.test(trimmed)) return "invalid";
  return trimmed.toUpperCase();
}

/// Парсимо ISO-string дату (з клієнта йде або повний ISO з `toISOString()`,
/// або порожній рядок / null / undefined). Невалідне → "invalid".
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const actor = await getAdminActor(req);
  if (!actor) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const { slug } = await params;
  if (!slug || !(slug in COURSES_BY_SLUG)) {
    return NextResponse.json({ error: "Невідомий slug курсу" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body ?? {}, k);

  // Зміна SP course ID — окремо, бо це поле моделі Course, не override.
  if (has("sendpulseCourseId")) {
    const raw = body.sendpulseCourseId;
    let spId: number | null;
    if (raw === null || raw === "" || raw === undefined) {
      spId = null;
    } else {
      const num = typeof raw === "number" ? raw : Number(String(raw).trim());
      if (!Number.isFinite(num) || num <= 0 || !Number.isInteger(num)) {
        return NextResponse.json(
          { error: "SendPulse course ID має бути цілим числом > 0" },
          { status: 400 },
        );
      }
      spId = num;
    }
    const before = await prisma.course.findUnique({
      where: { id: slug },
      select: { sendpulseCourseId: true },
    });
    await prisma.course.update({ where: { id: slug }, data: { sendpulseCourseId: spId } });
    const changes: ChangesMap = {};
    diffField("sendpulseCourseId", before?.sendpulseCourseId ?? null, spId, changes);
    await writeAudit(slug, actor, "update", changes);
    return NextResponse.json({ ok: true, sendpulseCourseId: spId });
  }

  // Збір нових значень з body — приймаємо лише ті поля, що передані.
  const before = await prisma.coursePriceOverride.findUnique({ where: { slug } });

  const price = has("price") ? parsePrice(body.price) : (before?.price ?? null);
  const oldPrice = has("oldPrice") ? parsePrice(body.oldPrice) : (before?.oldPrice ?? null);
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
  const promo2Code = has("promo2Code")
    ? parsePromoCode(body.promo2Code)
    : (before?.promo2Code ?? null);
  const promo2Price = has("promo2Price")
    ? parsePrice(body.promo2Price)
    : (before?.promo2Price ?? null);
  const promo2StartsAt = has("promo2StartsAt")
    ? parseDate(body.promo2StartsAt)
    : (before?.promo2StartsAt ?? null);
  const promo2ExpiresAt = has("promo2ExpiresAt")
    ? parseDate(body.promo2ExpiresAt)
    : (before?.promo2ExpiresAt ?? null);

  if (
    price === "invalid" ||
    oldPrice === "invalid" ||
    promo1Price === "invalid" ||
    promo2Price === "invalid"
  ) {
    return NextResponse.json({ error: "Ціна має бути цілим числом ≥ 0" }, { status: 400 });
  }
  if (promo1Code === "invalid" || promo2Code === "invalid") {
    return NextResponse.json(
      { error: "Промокод має бути 2–32 символи (латиниця, цифри, - та _)" },
      { status: 400 },
    );
  }
  if (
    promo1StartsAt === "invalid" ||
    promo1ExpiresAt === "invalid" ||
    promo2StartsAt === "invalid" ||
    promo2ExpiresAt === "invalid"
  ) {
    return NextResponse.json({ error: "Невалідна дата дії промокоду" }, { status: 400 });
  }
  // startsAt має бути < expiresAt, якщо обидва задані.
  if (
    promo1StartsAt &&
    promo1ExpiresAt &&
    promo1StartsAt.getTime() >= promo1ExpiresAt.getTime()
  ) {
    return NextResponse.json(
      { error: "Для Промо 1: дата початку має бути раніше за дату завершення" },
      { status: 400 },
    );
  }
  if (
    promo2StartsAt &&
    promo2ExpiresAt &&
    promo2StartsAt.getTime() >= promo2ExpiresAt.getTime()
  ) {
    return NextResponse.json(
      { error: "Для Промо 2: дата початку має бути раніше за дату завершення" },
      { status: 400 },
    );
  }
  // Якщо промо очищено (немає коду) — таймер теж має бути очищений (data hygiene).
  if (promo1Code === null && (promo1StartsAt !== null || promo1ExpiresAt !== null)) {
    return NextResponse.json(
      { error: "Не можна задавати таймер без промокоду 1" },
      { status: 400 },
    );
  }
  if (promo2Code === null && (promo2StartsAt !== null || promo2ExpiresAt !== null)) {
    return NextResponse.json(
      { error: "Не можна задавати таймер без промокоду 2" },
      { status: 400 },
    );
  }

  // Промо без коду НЕ повинно мати ціну, і навпаки.
  if ((promo1Code === null) !== (promo1Price === null)) {
    return NextResponse.json(
      { error: "Для Промо 1 заповніть і код, і ціну (або очистіть обидва)" },
      { status: 400 },
    );
  }
  if ((promo2Code === null) !== (promo2Price === null)) {
    return NextResponse.json(
      { error: "Для Промо 2 заповніть і код, і ціну (або очистіть обидва)" },
      { status: 400 },
    );
  }
  // Два однакові коди в одному курсі — заборонено (інакше непередбачувано який спрацює).
  if (
    promo1Code !== null &&
    promo2Code !== null &&
    promo1Code === promo2Code
  ) {
    return NextResponse.json(
      { error: "Промокоди 1 і 2 не можуть бути однаковими" },
      { status: 400 },
    );
  }

  // Якщо всі поля null — стираємо рядок.
  const allNull =
    price === null &&
    oldPrice === null &&
    promo1Code === null &&
    promo1Price === null &&
    promo1StartsAt === null &&
    promo1ExpiresAt === null &&
    promo2Code === null &&
    promo2Price === null &&
    promo2StartsAt === null &&
    promo2ExpiresAt === null;

  if (allNull) {
    if (before) {
      await prisma.coursePriceOverride.delete({ where: { slug } });
      const changes: ChangesMap = {};
      diffField("price", before.price, null, changes);
      diffField("oldPrice", before.oldPrice, null, changes);
      diffField("promo1Code", before.promo1Code, null, changes);
      diffField("promo1Price", before.promo1Price, null, changes);
      diffDateField("promo1StartsAt", before.promo1StartsAt ?? null, null, changes);
      diffDateField("promo1ExpiresAt", before.promo1ExpiresAt ?? null, null, changes);
      diffField("promo2Code", before.promo2Code, null, changes);
      diffField("promo2Price", before.promo2Price, null, changes);
      diffDateField("promo2StartsAt", before.promo2StartsAt ?? null, null, changes);
      diffDateField("promo2ExpiresAt", before.promo2ExpiresAt ?? null, null, changes);
      await writeAudit(slug, actor, "update", changes);
    }
    await recalcAutoPricedBundlesForCourse(slug);
    revalidateCoursesPages(slug);
    return NextResponse.json({ ok: true, cleared: true });
  }

  const override = await prisma.coursePriceOverride.upsert({
    where: { slug },
    create: {
      slug,
      price,
      oldPrice,
      promo1Code,
      promo1Price,
      promo1StartsAt,
      promo1ExpiresAt,
      promo2Code,
      promo2Price,
      promo2StartsAt,
      promo2ExpiresAt,
    },
    update: {
      price,
      oldPrice,
      promo1Code,
      promo1Price,
      promo1StartsAt,
      promo1ExpiresAt,
      promo2Code,
      promo2Price,
      promo2StartsAt,
      promo2ExpiresAt,
    },
  });

  const changes: ChangesMap = {};
  diffField("price", before?.price ?? null, price, changes);
  diffField("oldPrice", before?.oldPrice ?? null, oldPrice, changes);
  diffField("promo1Code", before?.promo1Code ?? null, promo1Code, changes);
  diffField("promo1Price", before?.promo1Price ?? null, promo1Price, changes);
  diffDateField("promo1StartsAt", before?.promo1StartsAt ?? null, promo1StartsAt, changes);
  diffDateField("promo1ExpiresAt", before?.promo1ExpiresAt ?? null, promo1ExpiresAt, changes);
  diffField("promo2Code", before?.promo2Code ?? null, promo2Code, changes);
  diffField("promo2Price", before?.promo2Price ?? null, promo2Price, changes);
  diffDateField("promo2StartsAt", before?.promo2StartsAt ?? null, promo2StartsAt, changes);
  diffDateField("promo2ExpiresAt", before?.promo2ExpiresAt ?? null, promo2ExpiresAt, changes);
  await writeAudit(slug, actor, "update", changes);

  await recalcAutoPricedBundlesForCourse(slug);
  revalidateCoursesPages(slug);
  return NextResponse.json(override);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const actor = await getAdminActor(req);
  if (!actor) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "Відсутній slug" }, { status: 400 });
  }

  const before = await prisma.coursePriceOverride.findUnique({ where: { slug } });
  await prisma.coursePriceOverride.deleteMany({ where: { slug } });

  if (before) {
    const changes: ChangesMap = {};
    diffField("price", before.price, null, changes);
    diffField("oldPrice", before.oldPrice, null, changes);
    diffField("promo1Code", before.promo1Code, null, changes);
    diffField("promo1Price", before.promo1Price, null, changes);
    diffDateField("promo1StartsAt", before.promo1StartsAt ?? null, null, changes);
    diffDateField("promo1ExpiresAt", before.promo1ExpiresAt ?? null, null, changes);
    diffField("promo2Code", before.promo2Code, null, changes);
    diffField("promo2Price", before.promo2Price, null, changes);
    diffDateField("promo2StartsAt", before.promo2StartsAt ?? null, null, changes);
    diffDateField("promo2ExpiresAt", before.promo2ExpiresAt ?? null, null, changes);
    await writeAudit(slug, actor, "reset", changes);
  }

  await recalcAutoPricedBundlesForCourse(slug);
  revalidateCoursesPages(slug);
  return NextResponse.json({ ok: true });
}
