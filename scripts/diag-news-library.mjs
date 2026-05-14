import prisma from './_db.mjs';

const all = await prisma.news.findMany({
  select: {
    id: true, title: true, slug: true,
    published: true, isTemplate: true,
    templateKind: true,
    createdAt: true,
  },
  orderBy: { createdAt: "desc" },
  take: 30,
});

console.log(`\nTotal recent news (max 30):  ${all.length}\n`);
console.table(all.map(n => ({
  title: (n.title || "").slice(0, 40),
  slug: (n.slug || "").slice(0, 24),
  published: n.published ? "✓" : "·",
  isTemplate: n.isTemplate ? "BLUEPRINT" : "·",
  templateKind: n.templateKind || "·",
  created: n.createdAt.toISOString().slice(0,16),
})));

const byBucket = {
  publishedTemplateNews: all.filter(n => n.published && !n.isTemplate && n.templateKind).length,
  publishedFreeForm: all.filter(n => n.published && !n.isTemplate && !n.templateKind).length,
  draftTemplateNews: all.filter(n => !n.published && !n.isTemplate && n.templateKind).length,
  draftFreeForm: all.filter(n => !n.published && !n.isTemplate && !n.templateKind).length,
  blueprintTemplates: all.filter(n => n.isTemplate).length,
};
console.log("\nBy bucket:", byBucket);

await prisma.$disconnect();
