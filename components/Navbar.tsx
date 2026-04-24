"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FaBars, FaTimes, FaChevronDown } from "react-icons/fa";
import AuthButtons from "@/components/AuthButtons";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);
  const linksContainerRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [overflowCount, setOverflowCount] = useState(0);
  const t = useTranslations("Navigation");

  const isActivePath = (path: string) => {
    const clean = pathname.replace(/^\/(uk|pl|en)/, '') || '/';
    if (path === '/') return clean === '/';
    return clean === path || clean.startsWith(path + '/');
  };

  const linkClass = (path: string) =>
    `px-2 py-1 transition-all duration-300 rounded-md whitespace-nowrap ${
      isActivePath(path)
        ? "bg-[#1C3A2E] text-white"
        : "text-[#1C3A2E] hover:text-[#D4A843]"
    }`;

  // prefetch=false для рідко відвідуваних сторінок: клієнт все ще отримає їх
  // при кліку (лише +100-300 ms), але сервер не буде довбаним RSC-prefetch-ами
  // на кожен візит (було до 15 _rsc= на сторінку).
  type NavLink = { href: string; label: string; prefetch?: false };

  // Порядок від найважливішого до найменш — overflow тікає у "Ще" з кінця.
  const allLinks: NavLink[] = [
    { href: "/", label: t("home") },
    { href: "/courses", label: t("courses") },
    { href: "/yearly-program", label: t("yearly-program") },
    { href: "/consultations", label: t("consultations") },
    { href: "/games", label: t("games") },
    { href: "/news", label: t("news") },
    { href: "/contacts", label: t("contacts") },
    { href: "/charity", label: t("charity"), prefetch: false },
    { href: "/partners", label: t("partners"), prefetch: false },
    { href: "/additional-materials", label: t("additionalMaterials"), prefetch: false },
  ];

  const isActive = (path: string) => isActivePath(path);

  const inlineCount = allLinks.length - overflowCount;
  const inlineLinks = allLinks.slice(0, inlineCount);
  const dropdownLinks = allLinks.slice(inlineCount);
  const showMore = dropdownLinks.length > 0;
  const isMoreActive = dropdownLinks.some((l) => isActivePath(l.href));

  // Динамічний overflow: вимірюємо ширину кожного посилання + кнопки "Ще"
  // у прихованому контейнері, рахуємо скільки вліземо в доступну ширину.
  // ResizeObserver на реальному контейнері викликає перерахунок при resize/zoom.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const compute = () => {
      const container = linksContainerRef.current;
      const measure = measureRef.current;
      if (!container || !measure) return;
      const available = container.clientWidth;
      const children = Array.from(measure.children) as HTMLElement[];
      const linkWidths = children.slice(0, allLinks.length).map((el) => el.getBoundingClientRect().width);
      const moreWidth = children[allLinks.length]?.getBoundingClientRect().width ?? 0;
      const gap = 4; // gap-1 = 0.25rem

      const fullTotal = linkWidths.reduce((s, x) => s + x, 0) + gap * Math.max(0, linkWidths.length - 1);
      // -1 px tolerance проти sub-pixel округлень
      if (fullTotal <= available + 1) {
        setOverflowCount(0);
        return;
      }
      // Не вміщається все — потрібна кнопка "Ще". Знаходимо максимальне k.
      let kept = 0;
      let acc = moreWidth;
      for (let i = 0; i < linkWidths.length; i++) {
        const nextAcc = acc + linkWidths[i] + gap;
        if (nextAcc > available + 1) break;
        acc = nextAcc;
        kept = i + 1;
      }
      setOverflowCount(linkWidths.length - kept);
    };

    compute();
    const ro = new ResizeObserver(compute);
    if (linksContainerRef.current) ro.observe(linksContainerRef.current);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allLinks.length, t]);

  // Закриваємо dropdown при кліку поза ним або Escape
  useEffect(() => {
    if (!moreOpen) return;
    const onClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  // Закриваємо dropdown при переході на іншу сторінку
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  return (
    <>
      <nav className="bg-white shadow-md sticky top-0 z-50 backdrop-blur-sm bg-white/90">
        <div className="container mx-auto px-4">

          {/* Desktop — від xl (1280px) */}
          <div className="hidden xl:flex items-center h-16 gap-3">
            <Link href="/" className="flex items-center group flex-shrink-0">
              <div className="relative overflow-hidden rounded-full transition-transform duration-300 group-hover:scale-110">
                <Image src="/logo.jpg" alt="UIMP" width={40} height={40} className="rounded-full" />
              </div>
            </Link>
            <div
              ref={linksContainerRef}
              className="flex-1 min-w-0 flex items-center justify-end gap-1"
              style={{ fontSize: 'clamp(10px, 1vw, 14px)' }}
            >
              {inlineLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={link.prefetch}
                  className={linkClass(link.href)}
                >
                  {link.label}
                </Link>
              ))}
              {showMore && (
                <div className="relative" ref={moreRef}>
                  <button
                    type="button"
                    onClick={() => setMoreOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={moreOpen}
                    className={`px-2 py-1 transition-all duration-300 rounded-md whitespace-nowrap inline-flex items-center gap-1 ${
                      isMoreActive || moreOpen
                        ? "bg-[#1C3A2E] text-white"
                        : "text-[#1C3A2E] hover:text-[#D4A843]"
                    }`}
                  >
                    <span>{t("more")}</span>
                    <FaChevronDown
                      size={10}
                      className={`transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {moreOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-full mt-2 min-w-[200px] bg-white rounded-lg shadow-lg border border-black/5 py-1 z-50"
                    >
                      {dropdownLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          prefetch={link.prefetch}
                          role="menuitem"
                          onClick={() => setMoreOpen(false)}
                          className={`block px-4 py-2 text-sm whitespace-nowrap transition-colors ${
                            isActivePath(link.href)
                              ? "bg-[#1C3A2E] text-white"
                              : "text-[#1C3A2E] hover:bg-[#E8F5E0] hover:text-[#D4A843]"
                          }`}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <LanguageSwitcher />
              <AuthButtons />
            </div>
            {/* Прихований контейнер для вимірювання ширини посилань.
                Той самий fontSize/padding/whiteSpace — тому getBoundingClientRect
                повертає точну ширину inline-варіанту. */}
            <div
              ref={measureRef}
              aria-hidden="true"
              style={{
                position: 'absolute',
                visibility: 'hidden',
                pointerEvents: 'none',
                left: -99999,
                top: 0,
                display: 'flex',
                gap: 4,
                fontSize: 'clamp(10px, 1vw, 14px)',
                whiteSpace: 'nowrap',
              }}
            >
              {allLinks.map((link) => (
                <span key={link.href} className="px-2 py-1 rounded-md whitespace-nowrap">
                  {link.label}
                </span>
              ))}
              <span className="px-2 py-1 rounded-md inline-flex items-center gap-1 whitespace-nowrap">
                {t("more")}
                <FaChevronDown size={10} />
              </span>
            </div>
          </div>

          {/* Mobile/Tablet header — до xl */}
          <div className="flex xl:hidden items-center h-16 gap-3">
            <Link href="/" className="flex items-center group flex-shrink-0">
              <div className="relative overflow-hidden rounded-full transition-transform duration-300 group-hover:scale-110">
                <Image src="/logo.jpg" alt="UIMP" width={40} height={40} className="rounded-full" />
              </div>
            </Link>
            <div className="flex items-center gap-3 ml-auto flex-shrink-0">
              <LanguageSwitcher />
              <AuthButtons />
              <button
                onClick={() => setMenuOpen(prev => !prev)}
                className="p-2 rounded-lg text-[#1C3A2E] hover:bg-[#E8F5E0] transition-colors"
                aria-label="Меню"
              >
                {menuOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Overlay — поза nav, щоб уникнути stacking context конфліктів */}
      {menuOpen && (
        <div
          className="xl:hidden fixed inset-0 bg-black/40"
          style={{ top: '64px', zIndex: 55 }}
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Right side panel — поза nav */}
      <div
        className="xl:hidden fixed top-16 right-0 h-[calc(100vh-64px)] bg-white shadow-2xl overflow-y-auto transition-transform duration-300 ease-in-out"
        style={{
          width: '280px',
          zIndex: 60,
          transform: menuOpen ? 'translateX(0)' : 'translateX(100%)',
          pointerEvents: menuOpen ? 'auto' : 'none',
          borderLeft: '1px solid rgba(28,58,46,0.1)',
        }}
      >
        <div className="px-4 py-4">
          {allLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={link.prefetch}
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
    </>
  );
}