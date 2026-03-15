import Link from "next/link";
import Image from "next/image";
import { FaCalendarCheck, FaHeart, FaArrowRight } from "react-icons/fa";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

const consultants = [
  {
    name: "Тетяна Шапошник",
    role: "Президентка UIMP, психотерапевтка",
    image: "/courses/psychology-basics/tetiana-shaposhnik.webp.webp",
    price: "2500 грн",
    duration: "50 хвилин",
    description: "Індивідуальна зустріч для підтримки у складних життєвих ситуаціях, духовного зцілення та професійної допомоги",
    href: "/consultations/tetiana-shaposhnyk",
    available: true,
  },
];

export default function ConsultationsPage() {
  return (
    <main className={`min-h-screen bg-gray-50 ${inter.className}`}>
      <section className="bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-sm mb-6">
            <FaHeart className="text-[#D4A843]" />
            Індивідуальна підтримка
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Консультації</h1>
          <p className="text-white/70 text-lg max-w-xl mx-auto">
            Особиста зустріч з фахівцями UIMP для підтримки та зцілення
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-6">
          {consultants.map((c, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden">
              <div className="bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] p-8 text-center">
                <div className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-[#D4A843] shadow-xl mx-auto mb-4">
                  <Image src={c.image} alt={c.name} fill className="object-cover" />
                </div>
                <h2 className="text-xl font-bold text-white mb-1">{c.name}</h2>
                <p className="text-white/70 text-sm">{c.role}</p>
              </div>
              <div className="p-6">
                <p className="text-gray-600 text-sm mb-6 text-center">{c.description}</p>
                <div className="flex items-center justify-between mb-6 bg-gray-50 rounded-xl p-4">
                  <div>
                    <p className="text-xs text-gray-400">Вартість</p>
                    <p className="text-2xl font-bold text-[#1C3A2E]">{c.price}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Тривалість</p>
                    <p className="font-medium text-gray-700">{c.duration}</p>
                  </div>
                </div>
                <Link href={c.href}
                  className="flex items-center justify-center gap-2 w-full bg-[#D4A843] text-white font-bold py-3 rounded-xl hover:bg-[#b88913] transition-colors">
                  <FaCalendarCheck /> Записатися <FaArrowRight className="text-sm" />
                </Link>
              </div>
            </div>
          ))}

          <div className="bg-white rounded-2xl shadow-sm border-2 border-dashed border-gray-200 flex items-center justify-center p-8 text-center">
            <div>
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                👤
              </div>
              <p className="font-medium text-gray-400">Незабаром</p>
              <p className="text-sm text-gray-300 mt-1">Новий консультант</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}