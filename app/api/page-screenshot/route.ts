import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { v2 as cloudinary } from "cloudinary";
import { chromium } from "playwright";
import net from "net";
import { lookup } from "dns/promises";

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

/// SSRF-захист. Ендпоінт бере довільний URL і ходить туди браузером з нашого
/// сервера, тобто зсередини приватної мережі Vercel. Без фільтра адмін (або
/// той, хто перехопив адмін-сесію) міг би прочитати cloud-metadata
/// (169.254.169.254), внутрішні сервіси та localhost. Тому резолвимо hostname
/// і блокуємо все, що вказує в приватні/зарезервовані діапазони.
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;         // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true;                        // multicast / reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    if (/^f[cd]/.test(v)) return true;  // unique local
    if (v.startsWith("fe80")) return true; // link-local
    return false;
  }
  return true; // не розпізнали — вважаємо небезпечним
}

const hostCheckCache = new Map<string, boolean>();

/// true — на цей hostname ходити можна.
async function isPublicHost(hostname: string): Promise<boolean> {
  const key = hostname.toLowerCase();
  const cached = hostCheckCache.get(key);
  if (cached !== undefined) return cached;

  let ok: boolean;
  const bare = key.replace(/^\[|\]$/g, "");
  if (net.isIP(bare)) {
    ok = !isPrivateIp(bare);
  } else if (key === "localhost" || key.endsWith(".localhost") || key.endsWith(".internal") || key.endsWith(".local")) {
    ok = false;
  } else {
    try {
      const addresses = await lookup(bare, { all: true });
      ok = addresses.length > 0 && addresses.every(a => !isPrivateIp(a.address));
    } catch {
      ok = false; // не резолвиться — все одно нема сенсу пускати
    }
  }

  if (hostCheckCache.size > 500) hostCheckCache.clear(); // простий cap, щоб не текла памʼять
  hostCheckCache.set(key, ok);
  return ok;
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

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: "Невалідний URL" }, { status: 400 });
  }
  if (!(await isPublicHost(target.hostname))) {
    return NextResponse.json({ error: "Цей хост заблоковано (внутрішня мережа)" }, { status: 400 });
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

    // Другий рубіж SSRF-захисту: перевірки URL-а мало, бо сторінка може
    // редіректнути або підтягнути ресурс із внутрішньої мережі (а також
    // DNS rebinding між нашою перевіркою і запитом браузера). Тому кожен
    // запит браузера проганяємо через той самий фільтр хостів.
    await context.route("**/*", async (route) => {
      try {
        const reqUrl = new URL(route.request().url());
        if (reqUrl.protocol !== "http:" && reqUrl.protocol !== "https:") return route.abort();
        if (!(await isPublicHost(reqUrl.hostname))) return route.abort();
        return route.continue();
      } catch {
        return route.abort();
      }
    });

    // Двофазне очікування. networkidle (вся мережа стихла) — найкраща якість
    // скріна, але багато сайтів його не досягають через analytics/chat-widgets/
    // long-polling. Тому чекаємо load (DOM + статика завантажились) як hard
    // gate, потім "best effort" namагаємось networkidle на 8с — якщо не встиг,
    // ігноримо і робимо скрін все одно. Так замість 30с timeout-у отримуємо
    // успішний скрін за ~10-12с навіть на проблемних сайтах.
    await page.goto(url, { waitUntil: "load", timeout: 30000 });
    try {
      await page.waitForLoadState("networkidle", { timeout: 8000 });
    } catch {
      // networkidle не настав — ОК, продовжуємо. Це нормально для сайтів з
      // постійними фоновими запитами (heatmap, чат, аналітика).
    }
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
