"use client";

import { useTranslations } from "next-intl";
import {
  FaGraduationCap,
  FaUsers,
  FaVideo,
  FaUserFriends,
  FaAward,
  FaStar,
} from "react-icons/fa";

const WHY_ICONS = [FaGraduationCap, FaUsers, FaVideo, FaUserFriends, FaAward, FaStar];

export default function WhyChooseUimp() {
  const t = useTranslations("WhyChooseUimp");

  return (
    <section style={{ background: "#F7F3EE", padding: "64px 24px 40px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2
            style={{
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 700,
              color: "#1C3A2E",
              lineHeight: 1.1,
              letterSpacing: "-0.01em",
              margin: "0 0 12px",
            }}
          >
            {t("whyTitle")}
          </h2>
          <div style={{ height: 1, width: 320, margin: "0 auto 14px", background: "linear-gradient(90deg, transparent 0%, rgba(212,168,67,0.15) 20%, #D4A843 50%, rgba(212,168,67,0.15) 80%, transparent 100%)" }} />
          <p style={{ color: "#4A5E50", fontWeight: 500, fontSize: 15, margin: 0 }}>
            {t("whySubtitle")}
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {[1, 2, 3, 4, 5, 6].map((i) => {
            const Icon = WHY_ICONS[i - 1];
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: 18,
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.85)",
                  border: "1px solid rgba(28,58,46,0.08)",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(212,168,67,0.4)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(28,58,46,0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(28,58,46,0.08)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    background: "#1C3A2E",
                  }}
                >
                  <Icon style={{ fontSize: 14, color: "#fff" }} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#1C3A2E", margin: 0 }}>
                    {t(`why${i}`)}
                  </p>
                  <p
                    style={{
                      fontSize: 12.5,
                      color: "#4A5E50",
                      lineHeight: 1.55,
                      margin: "4px 0 0",
                    }}
                  >
                    {t(`why${i}Desc`)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
