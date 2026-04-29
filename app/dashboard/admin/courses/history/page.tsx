import prisma from "@/lib/prisma";
import { COURSES_BY_SLUG } from "@/lib/coursesCatalog";
import HistoryView, { type HistoryEntry } from "./_components/HistoryView";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 200;

export default async function CoursesHistoryPage() {
  const logs = await prisma.coursePriceAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
  });

  const entries: HistoryEntry[] = logs.map((l) => ({
    id: l.id,
    slug: l.slug,
    courseTitle: COURSES_BY_SLUG[l.slug]?.titleUk ?? l.slug,
    courseIcon: COURSES_BY_SLUG[l.slug]?.icon ?? null,
    courseAccent: COURSES_BY_SLUG[l.slug]?.accent ?? null,
    userId: l.userId,
    userEmail: l.userEmail,
    userName: l.userName,
    action: l.action,
    changes: l.changes as Record<string, { old: unknown; new: unknown }>,
    createdAt: l.createdAt.toISOString(),
  }));

  return <HistoryView entries={entries} pageSize={PAGE_SIZE} />;
}
