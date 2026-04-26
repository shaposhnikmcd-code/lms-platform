import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { v2 as cloudinary } from "cloudinary";
import { chromium } from "playwright";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const runtime = "nodejs";
// Playwright cold start може зайняти 5-10с на першому виклику.
export const maxDuration = 60;

interface Body {
  url: string;
  viewportWidth?: number; // 1440 default
  waitMs?: number;        // ms додаткового sleep після loading (анімації, lazy-load)
  fullPage?: boolean;     // default true
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return NextResponse.json({ error: "Cloudinary не налаштовано на сервері" }, { status: 500 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Невалідний JSON" }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "Невалідний URL — має починатись з http(s)://" }, { status: 400 });
  }

  const viewportWidth = Math.min(2560, Math.max(320, body.viewportWidth || 1440));
  const waitMs = Math.min(10000, Math.max(0, body.waitMs ?? 800));
  const fullPage = body.fullPage !== false;

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: viewportWidth, height: 900 },
      deviceScaleFactor: 2, // retina-якість для скрінів
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    if (waitMs > 0) await page.waitForTimeout(waitMs);

    const buffer = await page.screenshot({ type: "png", fullPage, omitBackground: false });
    await browser.close();
    browser = null;

    const result = await new Promise<{ secure_url: string; width: number; height: number }>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: "uimp-news/page-screenshots" },
        (error, result) => {
          if (error || !result) reject(error || new Error("Empty Cloudinary response"));
          else resolve(result as { secure_url: string; width: number; height: number });
        }
      ).end(buffer);
    });

    return NextResponse.json({
      url: result.secure_url,
      width: result.width,
      height: result.height,
    });
  } catch (e) {
    if (browser) await browser.close().catch(() => {});
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[page-screenshot] failed:", msg);
    return NextResponse.json({ error: `Не вдалось зробити скрін: ${msg}` }, { status: 500 });
  }
}
