import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

// Сторінка-заглушка («в розробці») — поза індексом, доки не наповнена.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Common" });
  return { title: t("additionalMaterials"), description: t("underConstruction"), robots: { index: false, follow: true } };
}

export default async function AdditionalMaterialsPage() {
  const t = await getTranslations("Common");
  return (
    <main style={{ minHeight: '100vh', background: '#FAF6F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' as const }}>
        <h1 style={{ fontFamily: sysFont, fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, color: '#1C3A2E', margin: '0 0 16px', letterSpacing: '-0.02em' }}>
          {t("additionalMaterials")}
        </h1>
        <p style={{ fontFamily: sysFont, fontSize: '14px', color: 'rgba(28,58,46,0.4)' }}>
          {t("underConstruction")}
        </p>
      </div>
    </main>
  );
}
