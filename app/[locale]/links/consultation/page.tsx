import Image from 'next/image';
import { FaCalendarCheck, FaHeart } from 'react-icons/fa';
import { Inter } from 'next/font/google';
import { getTranslations } from 'next-intl/server';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export default async function ConsultationPage() {
  const t = await getTranslations("ConsultationLink");
  return (
    <main className={`min-h-screen bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] ${inter.className}`}>
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-20">
        <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 md:p-12 shadow-2xl">
          <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
            <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-[#D4A017] shadow-xl">
              <Image src="/courses/psychology-basics/tetiana-shaposhnik.webp" alt={t("name")} fill className="object-cover" priority />
            </div>
            <div className="text-center md:text-left">
              <div className="inline-flex items-center gap-2 bg-[#D4A017] text-white px-4 py-2 rounded-full text-sm mb-4">
                <FaHeart />
                <span>{t("badge")}</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{t("name")}</h1>
              <p className="text-white/80">{t("role")}</p>
            </div>
          </div>
          <div className="bg-white/5 rounded-2xl p-6 text-center">
            <div className="mb-4">
              <span className="text-white/60 text-sm">{t("costLabel")}</span>
              <div className="text-5xl font-bold text-white mt-2">{t("price")}</div>
              <p className="text-white/60 text-sm mt-1">{t("duration")}</p>
            </div>
            <a href="https://calendly.com/saposniktana878/50" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-3 bg-[#D4A017] text-white font-bold px-10 py-4 rounded-xl hover:bg-[#b88913] transition-all duration-300 w-full md:w-auto md:px-16 text-lg">
              <FaCalendarCheck className="text-xl" />
              {t("btnBook")}
            </a>
            <p className="text-white/40 text-sm mt-4">{t("calendarHint")}</p>
          </div>
          <p className="text-white/60 text-center text-sm mt-6 max-w-md mx-auto">
            {t("description")}
          </p>
        </div>
      </div>
    </main>
  );
}
