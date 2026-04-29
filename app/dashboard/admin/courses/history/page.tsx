import prisma from "@/lib/prisma";
import { COURSES_BY_SLUG } from "@/lib/coursesCatalog";
import HistoryView, { type HistoryEntry } from "./_components/HistoryView";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 200;

const CATEGORY_META: Record<string, { titleUk: string; icon: string; accent: string }> = {
  bundle: { titleUk: 'Пакети курсів', icon: '📦', accent: '#D4A843' },
  connector: { titleUk: 'Гра Конектор', icon: '🧩', accent: '#7C9D7C' },
  yearly: { titleUk: 'Річна програма (Річна підписка)', icon: '📅', accent: '#9C6FB6' },
  monthly: { titleUk: 'Річна програма (Місячний платіж)', icon: '🔁', accent: '#6FA8B6' },
};

function resolveSlugMeta(slug: string) {
  if (slug.startsWith('category:')) {
    const key = slug.slice('category:'.length);
    const meta = CATEGORY_META[key];
    if (meta) return { title: meta.titleUk, icon: meta.icon, accent: meta.accent };
    return { title: slug, icon: null, accent: null };
  }
  const c = COURSES_BY_SLUG[slug];
  return { title: c?.titleUk ?? slug, icon: c?.icon ?? null, accent: c?.accent ?? null };
}

export default async function CoursesHistoryPage() {
  const logs = await prisma.coursePriceAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
  });

  const entries: HistoryEntry[] = logs.map((l) => {
    const meta = resolveSlugMeta(l.slug);
    return {
      id: l.id,
      slug: l.slug,
      courseTitle: meta.title,
      courseIcon: meta.icon,
      courseAccent: meta.accent,
      userId: l.userId,
      userEmail: l.userEmail,
      userName: l.userName,
      action: l.action,
      changes: l.changes as Record<string, { old: unknown; new: unknown }>,
      createdAt: l.createdAt.toISOString(),
    };
  });

  return <HistoryView entries={entries} pageSize={PAGE_SIZE} />;
}
