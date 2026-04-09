"use client";

import { Link } from "@/i18n/navigation";
import { HiArrowUturnLeft } from "react-icons/hi2";

interface BackButtonProps {
  href: string;
  label?: string;
}

/**
 * Floating back button — solid premium FAB.
 *
 * Filled dark-green body with a thin gold inner border, layered shadows
 * and a soft outer halo. Looks the same on every background — no detection,
 * no flicker, no half-transparent compromise.
 */
export default function BackButton({ href, label = "Назад" }: BackButtonProps) {
  return (
    <Link
      href={href}
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
      {/* soft gold halo on hover */}
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
    </Link>
  );
}
