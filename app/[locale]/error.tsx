"use client";

import Link from "next/link";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
      </div>
    </div>
  );
}
