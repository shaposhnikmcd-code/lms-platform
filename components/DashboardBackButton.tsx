"use client";

import { useRouter, usePathname } from "next/navigation";
import { HiArrowUturnLeft } from "react-icons/hi2";

/**
 * Floating back button for /dashboard/* (uk-only).
 * Uses router.back() to return to the previous page. On the dashboard root
 * falls back to "/" since there is nothing meaningful to go back to.
 * Visual twin of components/BackButton.tsx.
 */
export default function DashboardBackButton() {
  const router = useRouter();
  const pathname = usePathname();

  const isRoot = pathname === "/dashboard/admin" || pathname === "/dashboard/admin/" || pathname === "/dashboard" || pathname === "/dashboard/";

  const handleClick = () => {
    if (isRoot) {
      router.push("/");
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard");
    }
  };

  const label = isRoot ? "На головну" : "Назад";

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      title={label}
      className="group back-btn fixed top-20 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white/90 transition-all duration-500 ease-out hover:text-white hover:scale-[1.06] active:scale-95"
      style={{
        backgroundImage:
          "linear-gradient(135deg, #1C3A2E 0%, #2a4f3f 25%, #D4A017 55%, #2a4f3f 80%, #1C3A2E 100%)",
        backgroundSize: "300% 300%",
        animation: "backBtnFlow 8s ease-in-out infinite",
        animationPlayState: "paused",
        boxShadow: [
          "0 6px 20px rgba(0, 0, 0, 0.18)",
          "0 2px 6px rgba(0, 0, 0, 0.12)",
          "0 0 0 1px rgba(255, 255, 255, 0.18)",
          "inset 0 1px 0 rgba(255, 255, 255, 0.22)",
        ].join(", "),
      }}
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          boxShadow:
            "0 0 0 1px rgba(212,160,23,0.55), 0 0 24px -4px rgba(212,160,23,0.45)",
        }}
      />
      <HiArrowUturnLeft
        className="relative text-[22px] transition-transform duration-500 ease-out group-hover:-translate-x-0.5 group-hover:-rotate-[8deg]"
        style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}
      />
    </button>
  );
}
