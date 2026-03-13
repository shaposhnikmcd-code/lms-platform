import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import "./globals.css";
import CookieBanner from "@/components/CookieBanner";
import Navbar from "@/components/Navbar"; // Імпортуємо Navbar

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
          <Navbar />
          <main>{children}</main>
          <CookieBanner />
        </SessionProviderWrapper>
      </body>
    </html>
  );
}