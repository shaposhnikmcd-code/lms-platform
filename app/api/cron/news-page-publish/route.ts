import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { publishStagedNewsPage } from "@/lib/newsPagePublish";

// Cron-handler: щогодини перевіряє чи настав nextPublishAt у NewsPage.
// Якщо так — копіює staged-копію (next*) у live і чистить staged-поля.
//
// Реєстрація: vercel.json → schedule "0 * * * *" (раз на годину).
// Авторизація: header Authorization: Bearer ${CRON_SECRET} — той самий механізм
// що в інших cron-роутах проєкту (yearly-subscriptions, тощо).
//
// Реалізація swap-у — у lib/newsPagePublish (один publishStagedNewsPage helper),
// щоб ручний клік "Опублікувати зараз" з адмінки і cron йшли тим самим кодом.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET не сконфігурований" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const page = await prisma.newsPage.findUnique({ where: { key: "default" } });

  // Нічого не заплановано — early return.
  if (!page || !page.nextPublishAt || page.nextContent === null) {
    return NextResponse.json({ ok: true, action: "no-op" });
  }

  // Час публікації ще не настав.
  if (page.nextPublishAt > now) {
    const diffMin = Math.round((page.nextPublishAt.getTime() - now.getTime()) / 60_000);
    return NextResponse.json({ ok: true, action: "wait", minutesUntil: diffMin });
  }

  // Час настав — публікуємо.
  const result = await publishStagedNewsPage();
  if (result.published) {
    try {
      revalidatePath("/uk/news"); revalidatePath("/en/news"); revalidatePath("/pl/news"); revalidatePath("/news");
    } catch {/* ignore */}
    console.log(`[cron/news-page-publish] published staged at ${result.publishedAt}`);
    return NextResponse.json({ ok: true, action: "published", publishedAt: result.publishedAt });
  }
  return NextResponse.json({ ok: false, action: "skipped", reason: result.reason });
}
