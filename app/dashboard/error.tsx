"use client";

import Link from "next/link";
import { useEffect } from "react";

/// Error boundary для всієї адмінки. Без нього падіння будь-якої сторінки
/// /dashboard/* спливало до global-error, який замінює ВЕСЬ документ — адмін
/// бачив голу 500-ку без меню і без шляху назад. Тут же ламається лише контент,
/// layout адмінки лишається на місці.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard-error]", {
      digest: error.digest ?? null,
      message: error.message,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Сторінка не завантажилась
        </h2>
        <p className="text-gray-600 text-sm mb-6">
          Стався збій під час рендеру цієї сторінки адмінки. Решта розділів працює —
          спробуйте оновити або поверніться на головну адмінки.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Спробувати ще раз
          </button>
          <Link
            href="/dashboard/admin"
            className="bg-gray-100 text-gray-800 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200"
          >
            До адмінки
          </Link>
        </div>
        {error.digest && (
          <p className="mt-6 text-[11px] text-gray-400 select-all">
            Код помилки: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
