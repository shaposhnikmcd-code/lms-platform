/// DEPRECATED — Аналітика тимчасово прибрана з адмінки (див. AdminDashboardView).
/// TODO: видалити директорію `app/dashboard/admin/analytics/` вручну (`rm -rf`).
/// Якщо сторінка знадобиться знову — повернути лінк у AdminDashboardView та
/// відкотити цей stub з git-історії.

import { notFound } from 'next/navigation';

export default function AdminAnalytics() {
  notFound();
}
