import { NextRequest, NextResponse } from "next/server";
import { verifyBearer } from "@/lib/authTiming";
import { maybeAutoPublishStagedNewsPage } from "@/lib/newsPagePublish";

/**
 * Щоденний cron публікації staged-сторінки /news.
 *
 * Запускається на 04:00 UTC (≈ 06:00–07:00 Київ залежно від DST). Дзвонить
 * `maybeAutoPublishStagedNewsPage` — якщо у БД є `nextPublishAt <= now()`
 * (тобто 06:00 Київ обраного дня вже настало), staged-копія копіюється у
 * live, кеш ревалідується.
 *
 * Це primary-механізм публікації за розкладом. Read-time auto-publish
 * (виклик у `app/[locale]/news/page.tsx`) залишений як safety-net на
 * випадок, якщо cron не відпрацював (Vercel deploy quiet-period, мережеві
 * глюки тощо). Подвійна публікація неможлива — після першого swap
 * `nextContent === null` і повторні виклики no-op.
 */
export async function GET(req: NextRequest) {
  if (!verifyBearer(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const published = await maybeAutoPublishStagedNewsPage();
  return NextResponse.json({
    ok: true,
    published,
    timestamp: new Date().toISOString(),
  });
}
