"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

export default function MissionSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const t = useTranslations("MissionSection");

  const missionData = [
    { num: "01", title: t("m1title"), items: [t("m1i1"), t("m1i2"), t("m1i3")] },
    { num: "02", title: t("m3title"), items: [t("m3i1"), t("m3i2"), t("m3i3"), t("m3i4")] },
    { num: "03", title: t("m2title"), items: [t("m2i1"), t("m2i2")] },
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} style={{ background: '#FAF6F0', padding: '56px 24px 64px', overflow: 'hidden', position: 'relative' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: 40, transform: visible ? 'translateY(0)' : 'translateY(40px)', opacity: visible ? 1 : 0, transition: 'transform 0.8s cubic-bezier(0.16,1,0.3,1), opacity 0.8s ease' }}>
          <h2 style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 700, color: '#1C3A2E', lineHeight: 1.1, margin: '0 0 12px' }}>
            {t("title")}
          </h2>
          <p style={{ fontSize: 14, color: '#6B7A6F', maxWidth: 440, margin: '0 auto', lineHeight: 1.6, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
            {t("subtitle")}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', alignItems: 'start', gap: '0 8px' }}>
          {missionData.map((m, idx) => (
            <div
              key={m.num}
              style={{
                paddingLeft: idx === 0 ? 0 : 36,
                paddingRight: idx === 2 ? 0 : 28,
                position: 'relative',
                transform: visible ? 'translateY(0)' : 'translateY(50px)',
                opacity: visible ? 1 : 0,
                transition: `transform 0.9s cubic-bezier(0.16,1,0.3,1) ${idx * 0.15}s, opacity 0.9s ease ${idx * 0.15}s`,
              }}
            >
              {idx > 0 && (
                <div style={{ position: 'absolute', left: 0, top: '5%', height: '90%', width: 1, background: 'linear-gradient(180deg, transparent, rgba(28,58,46,0.12) 20%, rgba(28,58,46,0.12) 80%, transparent)' }} />
              )}
              <span style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontSize: 48, fontWeight: 700, color: '#D4A843', opacity: 0.18, lineHeight: 1, marginBottom: 4, display: 'block', letterSpacing: '-2px' }}>
                {m.num}
              </span>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1C3A2E', lineHeight: 1.5, marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid rgba(212,168,67,0.3)', minHeight: 56, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
                {m.title}
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                {m.items.map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#4A5E50', lineHeight: 1.55, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#D4A843', flexShrink: 0, marginTop: 7, display: 'inline-block' }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}