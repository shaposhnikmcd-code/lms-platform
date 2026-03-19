import Link from "next/link";
import Image from "next/image";
import { FaCalendarCheck, FaHeart, FaArrowRight } from "react-icons/fa";
import { Inter } from "next/font/google";
import { getTranslatedContent } from "@/lib/translate";
import { consultationsContent } from "./_content/uk";

const inter = Inter({ subsets: ["latin", "cyrillic"] });
const getContent = getTranslatedContent(consultationsContent, "consultations-page");

export default async function ConsultationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);

  return (
    <main className={`min-h-screen bg-gray-50 ${inter.className}`}>
      <section className="bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-sm mb-6">
            <FaHeart className="text-[#D4A843]" />
            {c.badge}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{c.title}</h1>
          <p className="text-white/70 text-lg max-w-xl mx-auto">{c.subtitle}</p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-6">
          {c.consultants.map((consultant, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden">
              <div className="bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] p-8 text-center">
                <div className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-[#D4A843] shadow-xl mx-auto mb-4">
                  <Image src={consultant.image} alt={consultant.name} fill className="object-cover" />
                </div>
                <h2 className="text-xl font-bold text-white mb-1">{consultant.name}</h2>
                <p className="text-white/70 text-sm">{consultant.role}</p>
              </div>
              <div className="p-6">
                <p className="text-gray-600 text-sm mb-6 text-center">{consultant.description}</p>
                <div className="flex items-center justify-between mb-6 bg-gray-50 rounded-xl p-4">
                  <div>
                    <p className="text-xs text-gray-400">{c.costLabel}</p>
                    <p className="text-2xl font-bold text-[#1C3A2E]">{consultant.price}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">{c.durationLabel}</p>
                    <p className="font-medium text-gray-700">{consultant.duration}</p>
                  </div>
                </div>
                <Link href={consultant.href}
                  className="flex items-center justify-center gap-2 w-full bg-[#D4A843] text-white font-bold py-3 rounded-xl hover:bg-[#b88913] transition-colors">
                  <FaCalendarCheck /> {c.btnBook} <FaArrowRight className="text-sm" />
                </Link>
              </div>
            </div>
          ))}

          <div className="bg-white rounded-2xl shadow-sm border-2 border-dashed border-gray-200 flex items-center justify-center p-8 text-center">
            <div>
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                {"👤"}
              </div>
              <p className="font-medium text-gray-400">{c.soon}</p>
              <p className="text-sm text-gray-300 mt-1">{c.soonSubtitle}</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}