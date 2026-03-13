import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import Link from "next/link";
import "./globals.css";
import Image from "next/image";
import AuthButtons from "@/components/AuthButtons";
import CookieBanner from "@/components/CookieBanner";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="uk">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="antialiased">
        <SessionProviderWrapper session={session}>
          <nav className="bg-white shadow-md sticky top-0 z-50 backdrop-blur-sm bg-white/90">
            <div className="container mx-auto px-4">
              <div className="flex justify-between items-center h-16">
                <Link href="/" className="flex items-center group">
                  <div className="relative overflow-hidden rounded-full transition-transform duration-300 group-hover:scale-110">
                    <Image src="/logo.jpg" alt="UIMP" width={40} height={40} className="rounded-full" />
                  </div>
                </Link>
                <div className="flex gap-4 md:gap-6 items-center">
                  <Link href="/" className="text-[#1C3A2E] hover:text-[#D4A843] transition-all duration-300 px-2 py-1">Головна</Link>
                  <Link href="/courses" className="text-[#1C3A2E] hover:text-[#D4A843] transition-all duration-300 px-2 py-1">Курси</Link>
                  <Link href="/games" className="text-[#1C3A2E] hover:text-[#D4A843] transition-all duration-300 px-2 py-1">Ігри</Link>
                  <Link href="/links" className="text-[#1C3A2E] hover:text-[#D4A843] transition-all duration-300 px-2 py-1">База посилань</Link>
                  <Link href="/dashboard" className="text-[#1C3A2E] hover:text-[#D4A843] transition-all duration-300 px-2 py-1">Кабінет</Link>
                  <AuthButtons />
                </div>
              </div>
            </div>
          </nav>
          <main>{children}</main>
          <CookieBanner />
        </SessionProviderWrapper>
      </body>
    </html>
  );
}