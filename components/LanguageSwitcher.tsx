"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { FaChevronDown } from "react-icons/fa";

const LANGUAGES = [
  {
    code: "uk",
    label: "Українська",
    flag: (
      <svg width="20" height="14" viewBox="0 0 20 14" fill="none" style={{ borderRadius: "3px", flexShrink: 0 }}>
        <rect width="20" height="7" fill="#005BBB"/>
        <rect y="7" width="20" height="7" fill="#FFD500"/>
      </svg>
    ),
  },
  {
    code: "pl",
    label: "Polska",
    flag: (
      <svg width="20" height="14" viewBox="0 0 20 14" fill="none" style={{ borderRadius: "3px", flexShrink: 0 }}>
        <rect width="20" height="7" fill="#ffffff"/>
        <rect y="7" width="20" height="7" fill="#DC143C"/>
      </svg>
    ),
  },
  {
    code: "en",
    label: "English",
    flag: (
      <svg width="20" height="14" viewBox="0 0 60 40" fill="none" style={{ borderRadius: "3px", flexShrink: 0 }}>
        <rect width="60" height="40" fill="#012169"/>
        <path d="M0 0L60 40M60 0L0 40" stroke="white" strokeWidth="6"/>
        <path d="M0 0L60 40M60 0L0 40" stroke="#C8102E" strokeWidth="4"/>
        <path d="M30 0V40M0 20H60" stroke="white" strokeWidth="10"/>
        <path d="M30 0V40M0 20H60" stroke="#C8102E" strokeWidth="6"/>
      </svg>
    ),
  },
];

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const switchLanguage = (code: string) => {
    if (code === locale) { setOpen(false); return; }
    router.replace(pathname, { locale: code });
    setOpen(false);
  };

  const currentLang = LANGUAGES.find((l) => l.code === locale) || LANGUAGES[0];

  return (
    <div ref={ref} className="relative" style={{ flexShrink: 0 }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-[#1C3A2E] hover:bg-[#E8F5E0] transition-all"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
      >
        {currentLang.flag}
        <span>{currentLang.label}</span>
        <FaChevronDown style={{ fontSize: "9px" }} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl z-50 overflow-hidden"
          style={{ minWidth: "160px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
        >
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => switchLanguage(lang.code)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all hover:bg-[#E8F5E0] ${
                locale === lang.code ? "bg-[#1C3A2E] text-white hover:bg-[#1C3A2E]" : "text-[#1C3A2E]"
              }`}
            >
              {lang.flag}
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}