"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import AuthButtons from "@/components/AuthButtons";

export default function Navbar() {
  const pathname = usePathname();

  const linkClass = (path: string) =>
    `px-2 py-1 transition-all duration-300 rounded-md
    ${
      pathname === path
        ? "bg-[#1C3A2E] text-white"
        : "text-[#1C3A2E] hover:text-[#D4A843]"
    }`;

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50 backdrop-blur-sm bg-white/90">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          
          <Link href="/" className="flex items-center group">
            <div className="relative overflow-hidden rounded-full transition-transform duration-300 group-hover:scale-110">
              <Image
                src="/logo.jpg"
                alt="UIMP"
                width={40}
                height={40}
                className="rounded-full"
              />
            </div>
          </Link>

          <div className="flex gap-4 md:gap-6 items-center">
            <Link href="/" className={linkClass("/")}>
              Головна
            </Link>

            <Link href="/courses" className={linkClass("/courses")}>
              Курси
            </Link>

            <Link href="/games" className={linkClass("/games")}>
              Ігри
            </Link>

            <Link href="/links" className={linkClass("/links")}>
              База посилань
            </Link>

            <Link href="/dashboard" className={linkClass("/dashboard")}>
              Кабінет
            </Link>

            <AuthButtons />
          </div>
        </div>
      </div>
    </nav>
  );
}