"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

export default function MissionSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const t = useTranslations("MissionSection");

  const missionData = [
    { num: "01", title: t("m1title"), items: [t("m1i1"), t("m1i2"), t("m1i3")] },
    { num: "02", title: t("m2title"), items: [t("m2i1"), t("m2i2")] },
    { num: "03", title: t("m3title"), items: [t("m3i1"), t("m3i2"), t("m3i3"), t("m3i4")] },
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{ background: '#FAF6F0', padding: '96px 24px 104px', overflow: 'hidden', position: 'relative' }}
    >
      {/* Top divider */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent 0%, #D4A843 20%, #D4A843 80%, transparent 100%)', opacity: 0.5 }} />
      {/* Bottom divider */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent 0%, #D4A843 20%, #D4A843 80%, transparent 100%)', opacity: 0.5 }} />

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 72, transform: visible ? 'translateY(0)' : 'translateY(40px)', opacity: visible ? 1 : 0, transition: 'transform 0.8s cubic-bezier(0.16,1,0.3,1), opacity 0.8s ease' }}>
          <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '4px', textTransform: 'uppercase' as const, color: '#D4A843', marginBottom: 20, display: 'block' }}>
            {t("eyebrow")}
          </span>
          <h2 style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 'clamp(52px, 8vw, 96px)', fontWeight: 300, letterSpacing: '0.15em', color: '#1C3A2E', lineHeight: 1, margin: '0 0 28px', textTransform: 'uppercase' as const }}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
              <span style={{ display: 'inline-block', height: 1, width: 60, background: '#D4A843', opacity: 0.7 }} />
              {t("title")}
              <span style={{ display: 'inline-block', height: 1, width: 60, background: '#D4A843', opacity: 0.7 }} />
            </span>
          </h2>
          <p style={{ fontSize: 15, color: '#6B7A6F', maxWidth: 480, margin: '0 auto', lineHeight: 1.7, fontWeight: 300 }}>
            {t("subtitle")}
          </p>
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', alignItems: 'start' }}>
          {missionData.map((m, idx) => (
            <div
              key={m.num}
              style={{
                paddingLeft: idx === 0 ? 0 : 48,
                paddingRight: idx === 2 ? 0 : 40,
                paddingTop: 0,
                position: 'relative',
                transform: visible ? 'translateY(0)' : 'translateY(50px)',
                opacity: visible ? 1 : 0,
                transition: `transform 0.9s cubic-bezier(0.16,1,0.3,1) ${idx * 0.15}s, opacity 0.9s ease ${idx * 0.15}s`,
              }}
            >
              {/* Vertical separator */}
              {idx > 0 && (
                <div style={{ position: 'absolute', left: 0, top: '5%', height: '90%', width: 1, background: 'linear-gradient(180deg, transparent, rgba(28,58,46,0.15) 20%, rgba(28,58,46,0.15) 80%, transparent)' }} />
              )}

              <span style={{ fontFamily: 'Georgia, serif', fontSize: 72, fontWeight: 300, color: '#D4A843', opacity: 0.35, lineHeight: 1, marginBottom: 4, display: 'block', letterSpacing: '-2px' }}>
                {m.num}
              </span>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1C3A2E', lineHeight: 1.5, marginBottom: 28, paddingBottom: 20, borderBottom: '1.5px solid rgba(212,168,67,0.35)', minHeight: 72 }}>
                {m.title}
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
                {m.items.map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 13.5, color: '#4A5E50', lineHeight: 1.65 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#D4A843', flexShrink: 0, marginTop: 8, display: 'inline-block' }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Ornament */}
        <div style={{ textAlign: 'center', marginTop: 72, opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity 0.8s ease 0.6s, transform 0.8s ease 0.6s' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 1, background: '#D4A843', opacity: 0.4 }} />
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#D4A843', opacity: 0.4 }} />
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#D4A843', opacity: 0.4 }} />
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#D4A843', opacity: 0.4 }} />
            <div style={{ width: 48, height: 1, background: '#D4A843', opacity: 0.4 }} />
          </div>
        </div>

      </div>
    </section>
  );
}