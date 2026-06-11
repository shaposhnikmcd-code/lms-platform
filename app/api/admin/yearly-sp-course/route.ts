import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getAdminActor } from "@/lib/adminAuth";
import { YEARLY_SP_COURSE_SETTING_KEY } from "@/lib/yearlyProgramConfig";

/// PATCH — зберегти/очистити SendPulse course ID Річної програми.
/// Body: { sendpulseCourseId: number | null }. null/порожньо → видаляє AppSetting-рядок
/// (повертає поведінку до env-fallback `SENDPULSE_YEARLY_COURSE_ID`).
export async function PATCH(req: NextRequest) {
  const actor = await getAdminActor(req);
  if (!actor) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const raw = body.sendpulseCourseId;

  // Поточне значення (для audit-логу).
  const before = await prisma.appSetting.findUnique({
    where: { key: YEARLY_SP_COURSE_SETTING_KEY },
  });
  const prev = before?.value ?? null;

  let next: number | null;
  if (raw === null || raw === undefined || raw === "") {
    next = null;
  } else {
    const num = typeof raw === "number" ? raw : Number(String(raw).trim());
    if (!Number.isFinite(num) || num <= 0 || !Number.isInteger(num)) {
      return NextResponse.json(
        { error: "SP ID має бути цілим числом більше 0 (або порожнім)" },
        { status: 400 },
      );
    }
    next = num;
  }

  if (next === null) {
    await prisma.appSetting.deleteMany({ where: { key: YEARLY_SP_COURSE_SETTING_KEY } });
  } else {
    await prisma.appSetting.upsert({
      where: { key: YEARLY_SP_COURSE_SETTING_KEY },
      create: { key: YEARLY_SP_COURSE_SETTING_KEY, value: next },
      update: { value: next },
    });
  }

  if (prev !== next) {
    await prisma.coursePriceAuditLog.create({
      data: {
        slug: "category:yearly",
        userId: actor.id ?? null,
        userEmail: actor.email ?? null,
        userName: actor.name ?? null,
        action: "update",
        changes: { sendpulseCourseId: { old: prev, new: next } } as Prisma.InputJsonValue,
      },
    });
  }

  return NextResponse.json({ ok: true, sendpulseCourseId: next });
}
