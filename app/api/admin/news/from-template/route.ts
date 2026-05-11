import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminActor, isAdmin } from "@/lib/adminAuth";

// Створення нової News-новини з blueprint-у. Менеджер натискає на blueprint-картку
// у адмінці → POST сюди з blueprintId → створюється новий News-запис:
//   - isTemplate: false (це вже не blueprint)
//   - templateKind: copied
//   - templateData: copied (повна копія JSON)
//   - title: "{Назва blueprint-у} — нова" (легко перейменувати після)
//   - slug: автогенерується з base + timestamp
//   - published: false (вмикається менеджером після наповнення)
//   - imageUrl: copied з blueprint.imageUrl
//
// Повертаємо id нової новини — клієнт відкриває /[id]/template для редагування.

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }
  const actor = await getAdminActor(req);
  const body = await req.json().catch(() => ({}));
  const blueprintId = typeof body.blueprintId === "string" ? body.blueprintId : null;
  if (!blueprintId) {
    return NextResponse.json({ error: "blueprintId required" }, { status: 400 });
  }

  const blueprint = await prisma.news.findUnique({ where: { id: blueprintId } });
  if (!blueprint || !blueprint.isTemplate || !blueprint.templateKind) {
    return NextResponse.json({ error: "Blueprint не знайдено" }, { status: 404 });
  }

  const user = actor?.email
    ? await prisma.user.findUnique({ where: { email: actor.email } })
    : null;

  // Slug: base = blueprint.slug без "__template_" префікса + час; уникаємо колізій.
  const baseSlug = blueprint.slug.replace(/^__template_/, "") + "-" + Date.now().toString(36);

  const cloneTitle = blueprint.title.replace(/^\[Шаблон\]\s*/i, "");

  const created = await prisma.news.create({
    data: {
      title: cloneTitle + " — нова",
      slug: baseSlug,
      excerpt: blueprint.excerpt,
      category: blueprint.category,
      isTemplate: false, // ← клон НЕ blueprint
      templateKind: blueprint.templateKind,
      templateData: blueprint.templateData,
      content: "",
      previewContent: null,
      imageUrl: blueprint.imageUrl,
      pageBgColor: blueprint.pageBgColor,
      published: false,
      authorId: user?.id || null,
    },
  });

  return NextResponse.json({ id: created.id, slug: created.slug });
}
