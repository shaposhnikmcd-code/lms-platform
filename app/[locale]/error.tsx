"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Без цього логу помилка публічної сторінки зникала безслідно: у продакшені
  // Next віддає клієнту лише digest, а стек лишається в серверних логах —
  // знайти їх можна тільки за цим самим digest.
  useEffect(() => {
    console.error("[page-error]", {
      digest: error.digest ?? null,
      message: error.message,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center px-4">
        <h1 className="text-6xl font-bold text-blue-600 mb-4">500</h1>
        <h2 className="text-3xl font-semibold text-gray-900 mb-4">
          Щось пішло не так
        </h2>
        <p className="text-gray-600 mb-8">
          Виникла непередбачена помилка. Спробуйте ще раз або поверніться на головну.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Спробувати ще раз
          </button>
          <Link
            href="/"
            className="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300"
          >
            Повернутися на головну
          </Link>
        </div>
        {error.digest && (
          <p className="mt-8 text-xs text-gray-400 select-all">
            Код помилки: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
