import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import SessionProviderWrapper from "./components/SessionProviderWrapper";
import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "Dr. Shaposhnik - Платформа психологічних послуг",
  description: "Онлайн курси психології та саморозвитку",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="uk">
      <body className="bg-gray-50 min-h-screen">
        <SessionProviderWrapper session={session}>
          <nav className="bg-white shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center space-x-8">
                  <Link href="/" className="text-xl font-bold text-blue-600">
                    Dr. Shaposhnik
                  </Link>
                  <Link href="/courses" className="text-gray-700 hover:text-blue-600">
                    Курси
                  </Link>
                </div>
                
                <div className="flex items-center space-x-4">
                  {session ? (
                    <>
                      <Link href="/dashboard" className="text-gray-700 hover:text-blue-600">
                        Кабінет
                      </Link>
                      <Link
                        href="/api/auth/signout"
                        className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                      >
                        Вийти
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        className="text-gray-700 hover:text-blue-600"
                      >
                        Увійти
                      </Link>
                      <Link
                        href="/register"
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                      >
                        Реєстрація
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          </nav>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}