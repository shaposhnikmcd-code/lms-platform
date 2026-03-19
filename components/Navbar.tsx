"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { useState } from "react";
import { FaBars, FaTimes } from "react-icons/fa";
import AuthButtons from "@/components/AuthButtons";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const t = useTranslations("Navigation");

  const linkClass = (path: string) =>
    `px-2 py-1 transition-all duration-300 rounded-md ${
      pathname === path || pathname.replace(/^\/(uk|pl|en)/, '') === path
        ? "bg-[#1C3A2E] text-white"
        : "text-[#1C3A2E] hover:text-[#D4A843]"
    }`;

  const mobileLinkClass = (path: string) =>
    `block px-4 py-3 rounded-lg transition-all duration-200 ${
      pathname === path || pathname.replace(/^\/(uk|pl|en)/, '') === path
        ? "bg-[#1C3A2E] text-white"
        : "text-[#1C3A2E] hover:bg-[#E8F5E0]"
    }`;

  const navLinks = [
    { href: "/", label: t("home") },
    { href: "/courses", label: t("courses") },
    { href: "/learning", label: t("learning") },
    { href: "/consultations", label: t("consultations") },
    { href: "/games", label: t("games") },
    { href: "/news", label: t("news") },
    { href: "/contacts", label: t("contacts") },
    { href: "/links", label: t("links") },
  ];

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50 backdrop-blur-sm bg-white/90">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">

          <Link href="/" className="flex items-center group">
            <div className="relative overflow-hidden rounded-full transition-transform duration-300 group-hover:scale-110">
              <Image src="/logo.jpg" alt="UIMP" width={40} height={40} className="rounded-full" />
            </div>
          </Link>

          <div className="hidden lg:flex gap-4 items-center">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass(link.href)}>
                {link.label}
              </Link>
            ))}
            {status !== "loading" && session?.user && (
              <Link href="/dashboard" className={linkClass("/dashboard")}>{t("dashboard")}</Link>
            )}
            <LanguageSwitcher />
            <AuthButtons />
          </div>

          <div className="flex lg:hidden items-center gap-3">
            <LanguageSwitcher />
            <AuthButtons />
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-lg text-[#1C3A2E] hover:bg-[#E8F5E0] transition-colors"
              aria-label="Меню"
            >
              {menuOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
            </button>
          </div>

        </div>
      </div>

      {menuOpen && (
        <div className="lg:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-1 shadow-lg">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={mobileLinkClass(link.href)}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {status !== "loading" && session?.user && (
            <Link
              href="/dashboard"
              className={mobileLinkClass("/dashboard")}
              onClick={() => setMenuOpen(false)}
            >
              {t("dashboard")}
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}