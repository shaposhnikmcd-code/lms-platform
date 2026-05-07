// ⚠️ ОДНЕ ДЖЕРЕЛО ПРАВДИ для slug-генерації новин.
//
// Раніше /new (MetaSidebar) і /preview (SlugSidebar) мали окремі транслітератори
// з розбіжними правилами (ю→iu vs ю→yu, я→ia vs я→ya). Це ламало детекцію
// "користувач кастомізував slug" у SlugSidebar — будь-яке збережене у /new значення
// здавалося "ручним", і авто-синк після правки заголовку не працював.
//
// Тепер обидва сайдбари викликають `slugifyNewsTitle(title)` звідси.

import { transliterateUA } from "@/lib/translate";

/** Транслітерація UA → латиниця, нормалізація до URL-safe slug-а ([a-z0-9-]+).
 *  Стабільна: однаковий результат у /new (MetaSidebar) і /preview (SlugSidebar). */
export function slugifyNewsTitle(title: string): string {
  return transliterateUA(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
