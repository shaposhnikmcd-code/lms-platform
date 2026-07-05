import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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
  // Кастомний шаблон (asBlueprint=true) створюється з ПУСТОЮ назвою — менеджер
  // зобов'язаний дати свою (validation у TemplateConstructor блокує Save без неї).
  // Для звичайної новини (asBlueprint=false) лишаємо "{base} — нова" як hint.
  const cloneTitle = asBlueprint ? "" : `${cloneBase} — нова`;

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

  const baseData = {
    title: cloneTitle,
    excerpt: blueprint.excerpt,
    category: blueprint.category,
    isTemplate: asBlueprint,
    parentTemplateId,
    templateKind: blueprint.templateKind,
    templateData: blueprint.templateData,
    // Block-based template (Session 3+): копіюємо разом з legacy templateData,
    // щоб новий запис мав і structured (для backward-compat рендеру), і
    // block-based (для constructor-режиму) контент. Один з двох буде використано
    // залежно від наявності templateBlocks при public render-у.
    templateBlocks: blueprint.templateBlocks,
    templateCanvas: blueprint.templateCanvas,
    content: "",
    previewContent: null,
    imageUrl: blueprint.imageUrl,
    pageBgColor: blueprint.pageBgColor,
    published: false,
    authorId: user?.id || null,
  };

  // Прибираємо покинуті безіменні чернетки під тим самим дефолтом перед
  // створенням нової. «Створити Новий Шаблон» персистить копію дефолту одразу;
  // якщо менеджер кинув попередню не назвавши (Save заблоковано без назви), вона
  // лишалась фантом-копією й накопичувалась. Чистимо лише порожні (title="")
  // кастомні чернетки цього автора — названі/збережені не чіпаємо.
  if (asBlueprint) {
    await prisma.news.deleteMany({
      where: {
        isTemplate: true,
        parentTemplateId,
        title: "",
        ...(user?.id ? { authorId: user.id } : {}),
      },
    });
  }

  // Slug базується на Date.now() — при подвійному кліку/паралельних менеджерах
  // теоретично можлива колізія (P2002). Ретраїмо з рандомним суфіксом, а інші
  // помилки повертаємо чистим 500 без витоку сирого Prisma-меседжу.
  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = attempt === 0
      ? baseSlug
      : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const created = await prisma.news.create({ data: { ...baseData, slug } });
      return NextResponse.json({ id: created.id, slug: created.slug, isTemplate: created.isTemplate });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002" &&
        ((e.meta?.target as string[] | undefined) || []).includes("slug")
      ) {
        continue; // slug-колізія → новий суфікс
      }
      console.error("[POST /api/admin/news/from-template] create failed:", e);
      return NextResponse.json({ error: "Не вдалося створити запис із шаблону" }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "Не вдалося згенерувати унікальний slug — спробуйте ще раз" }, { status: 409 });
}
