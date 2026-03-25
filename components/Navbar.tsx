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
    `px-2 py-1 transition-all duration-300 rounded-md whitespace-nowrap ${
      pathname === path || pathname.replace(/^\/(uk|pl|en)/, '') === path
        ? "bg-[#1C3A2E] text-white"
        : "text-[#1C3A2E] hover:text-[#D4A843]"
    }`;

  const navLinks = [
    { href: "/", label: t("home") },
    { href: "/courses", label: t("courses") },
    { href: "/yearly-program", label: t("yearly-program") },
    { href: "/consultations", label: t("consultations") },
    { href: "/games", label: t("games") },
    { href: "/news", label: t("news") },
    { href: "/contacts", label: t("contacts") },
    { href: "/links", label: t("links") },
    { href: "/partners", label: t("partners") },
    { href: "/additional-materials", label: t("additionalMaterials") },
  ];

  const isActive = (path: string) =>
    pathname === path || pathname.replace(/^\/(uk|pl|en)/, '') === path;

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50 backdrop-blur-sm bg-white/90">
      <div className="container mx-auto px-4">

        {/* Desktop */}
        <div className="hidden 2xl:flex items-center h-16 gap-3">
          <Link href="/" className="flex items-center group flex-shrink-0">
            <div className="relative overflow-hidden rounded-full transition-transform duration-300 group-hover:scale-110">
              <Image src="/logo.jpg" alt="UIMP" width={40} height={40} className="rounded-full" />
            </div>
          </Link>
          <div className="flex-1" />
          <div className="flex items-center gap-1 flex-shrink-0" style={{ fontSize: 'clamp(11px, 1.1vw, 14px)' }}>
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass(link.href)}>
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <LanguageSwitcher />
            <AuthButtons />
          </div>
        </div>

        {/* Mobile/Tablet header */}
        <div className="flex 2xl:hidden items-center h-16 gap-3">
          <Link href="/" className="flex items-center group flex-shrink-0">
            <div className="relative overflow-hidden rounded-full transition-transform duration-300 group-hover:scale-110">
              <Image src="/logo.jpg" alt="UIMP" width={40} height={40} className="rounded-full" />
            </div>
          </Link>
          <div className="flex items-center gap-3 ml-auto flex-shrink-0">
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

      {/* Mobile menu */}
      {menuOpen && (
        <div className="2xl:hidden border-t border-gray-100 bg-white shadow-xl">
          <div className="px-4 py-3" style={{ maxWidth: '320px' }}>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'block',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: isActive(link.href) ? 600 : 400,
                  color: isActive(link.href) ? 'white' : '#1C3A2E',
                  background: isActive(link.href) ? '#1C3A2E' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                  marginBottom: '2px',
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}