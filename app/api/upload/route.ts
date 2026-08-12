import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 МБ
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error("❌ Cloudinary env vars missing");
    return NextResponse.json({ error: "Cloudinary не налаштовано на сервері" }, { status: 500 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "Файл не знайдено" }, { status: 400 });
  }

  // Ліміти до читання в память: без них будь-який адмінський клієнт міг залити
  // 500-мегабайтний файл (OOM на serverless) або довільний тип (PDF/SVG/HTML)
  // у CDN, з якого він потім віддається користувачам.
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `Файл завеликий: ${(file.size / 1024 / 1024).toFixed(1)} МБ. Максимум — 10 МБ.` },
      { status: 400 }
    );
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Непідтримуваний тип файлу${file.type ? ` (${file.type})` : ""}. Дозволені: JPEG, PNG, WebP, GIF.` },
      { status: 400 }
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: "uimp-news" },
        (error, result) => {
          if (error || !result) reject(error || new Error("Empty Cloudinary response"));
          else resolve(result as { secure_url: string });
        }
      ).end(buffer);
    });

    return NextResponse.json({ url: result.secure_url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("❌ Cloudinary upload failed:", msg);
    return NextResponse.json({ error: `Помилка завантаження: ${msg}` }, { status: 500 });
  }
}