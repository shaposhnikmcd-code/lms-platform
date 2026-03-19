import Link from "next/link";
import Image from "next/image";
import { FaCalendarCheck, FaHeart, FaArrowLeft } from "react-icons/fa";
import { Inter } from "next/font/google";
import { getTranslatedContent } from "@/lib/translate";
import { getCurrency } from "@/lib/currency";
import { tatianaContent } from "./_content/uk";

const inter = Inter({ subsets: ["latin", "cyrillic"] });
const getContent = getTranslatedContent(tatianaContent, "tatiana-consultation-page");

export default async function TatianaConsultationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);
  const currency = getCurrency(locale);

  return (
    <main className={`min-h-screen bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] ${inter.className}`}>
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-20">
        <Link href="/consultations"
          className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-8 transition-colors text-sm">
          <FaArrowLeft /> {c.backBtn}
        </Link>

        <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 md:p-12 shadow-2xl">
          <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
            <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-[#D4A017] shadow-xl">
              <Image
                src="/courses/psychology-basics/tetiana-shaposhnik.webp.webp"
                alt={c.name}
                fill
                className="object-cover"
                priority
              />
            </div>
            <div className="text-center md:text-left">
              <div className="inline-flex items-center gap-2 bg-[#D4A017] text-white px-4 py-2 rounded-full text-sm mb-4">
                <FaHeart />
                {c.badge}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{c.name}</h1>
              <p className="text-white/80">{c.role}</p>
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl p-6 text-center">
            <div className="mb-4">
              <span className="text-white/60 text-sm">{c.priceLabel}</span>
              <div className="text-5xl font-bold text-white mt-2">{c.price} {currency}</div>
              <p className="text-white/60 text-sm mt-1">{c.duration}</p>
            </div>
            <Link
              href="https://calendly.com/saposniktana878/50?fbclid=PAZXh0bgNhZW0CMTEAAaaSH0xocZeMS8EDUCwnKBbCEL977zl7zIToHtQHz9bPO3MwrdKBvYPlLa8_aem__8ua4VLX_y4HjtlJwVT6Pw&month=2026-03"
              target="_blank"
              className="inline-flex items-center justify-center gap-3 bg-[#D4A017] text-white font-bold px-10 py-4 rounded-xl hover:bg-[#b88913] transition-all duration-300 w-full md:w-auto md:px-16 text-lg"
            >
              <FaCalendarCheck className="text-xl" />
              {c.btnBook}
            </Link>
            <p className="text-white/40 text-sm mt-4">{c.calendarHint}</p>
          </div>

          <p className="text-white/60 text-center text-sm mt-6 max-w-md mx-auto">
            {c.description}
          </p>
        </div>
      </div>
    </main>
  );
}