"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // global-error замінює весь документ, тому це остання точка, де помилку взагалі
  // видно. Логуємо digest, щоб зіставити з серверним стеком у Vercel Runtime Logs.
  useEffect(() => {
    console.error("[global-error]", {
      digest: error.digest ?? null,
      message: error.message,
      stack: error.stack,
    });
  }, [error]);

  return (
    <html lang="uk">
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f9fafb",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ textAlign: "center", padding: "0 1rem" }}>
            <h1 style={{ fontSize: "4rem", fontWeight: "bold", color: "#2563eb", marginBottom: "1rem" }}>
              500
            </h1>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "600", color: "#111827", marginBottom: "1rem" }}>
              Щось пішло не так
            </h2>
            <p style={{ color: "#4b5563", marginBottom: "2rem" }}>
              Виникла непередбачена помилка. Спробуйте ще раз.
            </p>
            <button
              onClick={reset}
              style={{
                backgroundColor: "#2563eb",
                color: "#fff",
                padding: "0.75rem 1.5rem",
                borderRadius: "0.5rem",
                border: "none",
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              Спробувати ще раз
            </button>
            {error.digest && (
              <p style={{ marginTop: "2rem", fontSize: "0.75rem", color: "#9ca3af", userSelect: "all" }}>
                Код помилки: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
