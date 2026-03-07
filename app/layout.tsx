import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "LMS Platform",
  description: "Онлайн курси психології",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk">
      <body style={{fontFamily:"Arial"}}>

        <nav style={{
          padding:20,
          borderBottom:"1px solid #ddd",
          marginBottom:40
        }}>
          <Link href="/" style={{marginRight:20}}>Home</Link>
          <Link href="/courses" style={{marginRight:20}}>Courses</Link>
          <Link href="/dashboard" style={{marginRight:20}}>Dashboard</Link>
          <Link href="/login">Login</Link>
        </nav>

        {children}

      </body>
    </html>
  );
}