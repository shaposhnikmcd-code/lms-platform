import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CookieBanner from "@/components/CookieBanner";
import "../globals.css";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "uk" | "pl" | "en")) {
    notFound();
  }

  // Свідомо НЕ викликаємо getServerSession() — це робило весь tree dynamic
  // і ламало ISR для маркетингових сторінок. SessionProvider підтягне session
  // client-side через /api/auth/session при потребі (useSession в Navbar/AuthButtons).
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <SessionProviderWrapper>
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <CookieBanner />
      </SessionProviderWrapper>
    </NextIntlClientProvider>
  );
}
