import prisma from '@/lib/prisma';
import { COURSES_CATALOG } from '@/lib/coursesCatalog';

/**
 * Sync the static `coursesCatalog.ts` entries into the DB `Course` table.
 * Catalog is the source of truth: new/updated entries are upserted; existing
 * DB rows not in catalog are left untouched (might be referenced by payments).
 *
 * Called on admin pages that need the catalog visible (admin courses list,
 * bundle builder API). Cheap — ~7 upserts per call.
 */
export async function syncCatalogCourses() {
  await Promise.all(
    COURSES_CATALOG.map((c) =>
      prisma.course.upsert({
        where: { id: c.slug },
        create: {
          id: c.slug,
          slug: c.slug,
          title: c.titleUk,
          description: '',
          price: c.price,
          published: true,
        },
        update: {
          slug: c.slug,
          title: c.titleUk,
          price: c.price,
        },
      })
    )
  );
}
