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
  const promo2Code = has("promo2Code")
    ? parsePromoCode(body.promo2Code)
    : (before?.promo2Code ?? null);
  const promo2Price = has("promo2Price")
    ? parsePrice(body.promo2Price)
    : (before?.promo2Price ?? null);

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
    promo2Code === null &&
    promo2Price === null;

  if (allNull) {
    if (before) {
      await prisma.coursePriceOverride.delete({ where: { slug } });
      const changes: ChangesMap = {};
      diffField("price", before.price, null, changes);
      diffField("oldPrice", before.oldPrice, null, changes);
      diffField("promo1Code", before.promo1Code, null, changes);
      diffField("promo1Price", before.promo1Price, null, changes);
      diffField("promo2Code", before.promo2Code, null, changes);
      diffField("promo2Price", before.promo2Price, null, changes);
      await writeAudit(slug, actor, "update", changes);
    }
    await recalcAutoPricedBundlesForCourse(slug);
    revalidateCoursesPages(slug);
    return NextResponse.json({ ok: true, cleared: true });
  }

  const override = await prisma.coursePriceOverride.upsert({
    where: { slug },
    create: { slug, price, oldPrice, promo1Code, promo1Price, promo2Code, promo2Price },
    update: { price, oldPrice, promo1Code, promo1Price, promo2Code, promo2Price },
  });

  const changes: ChangesMap = {};
  diffField("price", before?.price ?? null, price, changes);
  diffField("oldPrice", before?.oldPrice ?? null, oldPrice, changes);
  diffField("promo1Code", before?.promo1Code ?? null, promo1Code, changes);
  diffField("promo1Price", before?.promo1Price ?? null, promo1Price, changes);
  diffField("promo2Code", before?.promo2Code ?? null, promo2Code, changes);
  diffField("promo2Price", before?.promo2Price ?? null, promo2Price, changes);
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
    diffField("promo2Code", before.promo2Code, null, changes);
    diffField("promo2Price", before.promo2Price, null, changes);
    await writeAudit(slug, actor, "reset", changes);
  }

  await recalcAutoPricedBundlesForCourse(slug);
  revalidateCoursesPages(slug);
  return NextResponse.json({ ok: true });
}
