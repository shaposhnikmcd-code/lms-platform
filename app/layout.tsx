import { getServerSession } from "next-auth";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import Link from "next/link";
import "./globals.css";
import Image from "next/image";
import AuthButtons from "@/components/AuthButtons";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  return (
    <html lang="uk">
      <body>
        <SessionProviderWrapper session={session}>
          <nav className="bg-white shadow-md">
            <div className="container mx-auto px-4">
              <div className="flex justify-between items-center h-16">
                <Link href="/" className="flex items-center">
                  <Image
                    src="/logo.jpg"
                    alt="UIMP"
                    width={40}
                    height={40}
                    className="rounded"
                  />
                  <span className="ml-2 text-[#1C3A2E] font-semibold">UIMP</span>
                </Link>
                
                <div className="flex gap-6 items-center">
                  <Link href="/courses" className="text-[#1C3A2E] hover:text-[#D4A843]">
                    Курси
                  </Link>
                  <Link href="/links" className="text-[#1C3A2E] hover:text-[#D4A843]">
                    База посилань
                  </Link>
                  <Link href="/dashboard" className="text-[#1C3A2E] hover:text-[#D4A843]">
                    Кабінет
                  </Link>
                  
                  {/* Додаємо компонент з кнопками авторизації */}
                  <AuthButtons />
                </div>
              </div>
            </div>
          </nav>
          <main>{children}</main>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}