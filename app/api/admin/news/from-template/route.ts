import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminActor, isAdmin } from "@/lib/adminAuth";

// Створення нового запису з blueprint-у. Два режими:
//
//   1) asBlueprint=false (default) — створює **звичайну News-новину**:
//      isTemplate=false, parentTemplateId=<sourceBlueprintId>. Менеджер
//      наповнює контент і публікує на /news.
//
//   2) asBlueprint=true — створює **кастомний blueprint** (підписаний шаблон):
//      isTemplate=true, parentTemplateId=<defaultBlueprintId>. Менеджер
//      редагує дефолти і присвоює власну назву. Видно як міні-картка під
//      дефолтним blueprint-ом у /dashboard/admin/news.
//
// Спільна логіка: повна копія templateData + imageUrl + pageBgColor + category.
// Title: для звичайної новини — "{base} — нова"; для кастомного шаблону —
// "{base} · копія" (легко перейменувати у редакторі).
// Повертаємо id нового запису — клієнт відкриває /[id]/template для редагування.

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }
  const actor = await getAdminActor(req);
  const body = await req.json().catch(() => ({}));
  const blueprintId = typeof body.blueprintId === "string" ? body.blueprintId : null;
  const asBlueprint = body.asBlueprint === true;
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
  // Для кастомного blueprint-у додаємо "tpl-" префікс, щоб у адмінці-listing-у
  // одразу відрізнити slug кастомного від звичайної новини.
  const cleanBase = blueprint.slug.replace(/^__template_/, "").replace(/^tpl-/, "");
  const slugPrefix = asBlueprint ? "tpl-" : "";
  const baseSlug = slugPrefix + cleanBase + "-" + Date.now().toString(36);

  const cloneBase = blueprint.title.replace(/^\[Шаблон\]\s*/i, "");
  const cloneTitle = asBlueprint
    ? `${cloneBase} · копія`
    : `${cloneBase} — нова`;

  // parentTemplateId:
  //   - asBlueprint=true: parent — це поточний blueprint, АЛЕ тільки якщо він
  //     сам дефолтний (parentTemplateId=null). Не дозволяємо створювати
  //     "онука" від кастомного шаблону — це ускладнює UX без додаткової
  //     цінності. Якщо source — кастомний, parent ставимо на його ж parent
  //     (тобто дефолтний blueprint цього kind).
  //   - asBlueprint=false: parent = sourceBlueprint завжди (зберігаємо
  //     походження новини, в т.ч. якщо створено з кастомного шаблону).
  const parentTemplateId = asBlueprint
    ? (blueprint.parentTemplateId || blueprint.id)
    : blueprint.id;

  const created = await prisma.news.create({
    data: {
      title: cloneTitle,
      slug: baseSlug,
      excerpt: blueprint.excerpt,
      category: blueprint.category,
      isTemplate: asBlueprint,
      parentTemplateId,
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

  return NextResponse.json({ id: created.id, slug: created.slug, isTemplate: created.isTemplate });
}
