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
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="antialiased">
        <SessionProviderWrapper session={session}>
          {/* Навігація з преміум-ефектами */}
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
                  {/* Напис приховано на мобільних */}
                </Link>
                
                <div className="flex gap-4 md:gap-6 items-center">
                  <Link 
                    href="/courses" 
                    className="text-[#1C3A2E] hover:text-[#D4A843] transition-all duration-300 relative group px-2 py-1"
                  >
                    <span className="relative z-10">Курси</span>
                    <span className="absolute inset-0 bg-[#D4A843] scale-0 group-hover:scale-100 transition-transform duration-300 rounded-lg opacity-10"></span>
                  </Link>
                  
                  <Link 
                    href="/links" 
                    className="text-[#1C3A2E] hover:text-[#D4A843] transition-all duration-300 relative group px-2 py-1"
                  >
                    <span className="relative z-10">База посилань</span>
                    <span className="absolute inset-0 bg-[#D4A843] scale-0 group-hover:scale-100 transition-transform duration-300 rounded-lg opacity-10"></span>
                  </Link>
                  
                  <Link 
                    href="/dashboard" 
                    className="text-[#1C3A2E] hover:text-[#D4A843] transition-all duration-300 relative group px-2 py-1"
                  >
                    <span className="relative z-10">Кабінет</span>
                    <span className="absolute inset-0 bg-[#D4A843] scale-0 group-hover:scale-100 transition-transform duration-300 rounded-lg opacity-10"></span>
                  </Link>
                  
                  {/* Додаємо компонент з кнопками авторизації */}
                  <AuthButtons />
                </div>
              </div>
            </div>
          </nav>

          {/* Основний контент з анімацією */}
          <main className="animate-fadeIn">{children}</main>

          {/* Скрипт для мікро-взаємодій */}
          <script dangerouslySetInnerHTML={{
            __html: `
              document.addEventListener('DOMContentLoaded', function() {
                // Плавна поява секцій при скролі
                const observer = new IntersectionObserver((entries) => {
                  entries.forEach(entry => {
                    if (entry.isIntersecting) {
                      entry.target.classList.add('animate-fadeIn');
                      observer.unobserve(entry.target);
                    }
                  });
                }, { threshold: 0.1, rootMargin: '50px' });

                document.querySelectorAll('section').forEach(section => {
                  section.classList.add('opacity-0');
                  observer.observe(section);
                });
              });
            `
          }} />
        </SessionProviderWrapper>
      </body>
    </html>
  );
}