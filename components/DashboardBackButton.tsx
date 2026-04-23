"use client";

import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { HiArrowUturnLeft } from "react-icons/hi2";

/**
 * Floating back button for /dashboard/* (uk-only).
 * Visual twin of components/BackButton.tsx.
 */
const ROLE_HOME: Record<string, string> = {
  ADMIN: "/dashboard/admin",
  MANAGER: "/dashboard/manager",
  TEACHER: "/dashboard/teacher",
  STUDENT: "/dashboard/student",
};

export default function DashboardBackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const roleHome = role ? ROLE_HOME[role] : null;

  const ROLE_ROOTS = ["/dashboard", "/dashboard/admin", "/dashboard/manager", "/dashboard/teacher", "/dashboard/student"];
  const normalized = pathname.replace(/\/$/, "");
  const isRoot = ROLE_ROOTS.includes(normalized);
  /// Юзер стоїть на "чужому" role-кабінеті (напр. ADMIN на /dashboard/manager) —
  /// повертаємо його до власного кабінету, а не на головну сайту.
  const onForeignRoleRoot =
    isRoot && !!roleHome && normalized !== "/dashboard" && normalized !== roleHome;

  const handleClick = () => {
    if (isRoot) {
      if (onForeignRoleRoot) {
        router.push(roleHome!);
        return;
      }
      router.push("/");
      return;
    }
    // Navigate up one level in the path. For `.../{id}/edit` patterns, skip
    // two segments because the dynamic-id level has no page and would 404.
    const segments = pathname.replace(/\/$/, "").split("/");
    segments.pop();
    if (pathname.replace(/\/$/, "").endsWith("/edit")) {
      segments.pop();
    }
    const parentPath = segments.join("/") || "/dashboard";
    router.push(parentPath);
  };

  const label = isRoot
    ? onForeignRoleRoot
      ? role === "ADMIN"
        ? "До адмінки"
        : "До кабінету"
      : "На головну"
    : "Назад";

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
