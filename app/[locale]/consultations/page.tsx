import Image from "next/image";
import { consultationsContent } from "./_content/uk";
import DiplomasSection from "@/components/home/DiplomasSection";
import { getTranslatedContent } from "@/lib/translate";
import { Link } from "@/i18n/navigation";

const getContent = getTranslatedContent(consultationsContent, 'consultations-page');

export default async function ConsultationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);

  return (
    <main className="min-h-screen bg-[#f4f9f4]">

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1C3A2E] to-[#0f2219] text-white py-20">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-[#D4A843]/20 border border-[#D4A843]/30 text-[#D4A843] text-sm font-semibold px-5 py-2 rounded-full mb-6 tracking-wide uppercase">
            {"◆"} {c.hero.badge}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">{c.hero.title}</h1>
          <p className="text-white/60 text-lg max-w-xl mx-auto">{c.hero.subtitle}</p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-16 space-y-8">

        {/* Реальні фахівці */}
        {c.specialists.map((s, i) => (
          <div key={i} className="bg-white rounded-3xl shadow-xl overflow-hidden">

            {/* Верхня частина: фото | про + спеціалізації | ціна */}
            <div className="grid lg:grid-cols-3 gap-0">

              {/* Фото */}
              <div className="relative lg:col-span-1">
                <div className="relative h-72 lg:h-full min-h-[360px] w-full overflow-hidden">
                  <Image
                    src={s.image}
                    alt={s.name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    className="object-cover object-top"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-1 h-6 bg-[#D4A843] rounded-full" />
                      <p className="text-xl font-bold">{s.name}</p>
                    </div>
                    <p className="text-white/70 text-sm pl-3">{s.role}</p>
                    <div className="flex items-center gap-2 mt-2 pl-3">
                      <div className="w-1.5 h-1.5 bg-[#D4A843] rounded-full" />
                      <p className="text-[#D4A843] text-xs font-medium">{s.experience}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Про фахівця + Працює з */}
              <div className="lg:col-span-1 flex flex-col border-l border-gray-100">
                <div className="px-7 py-6 border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-4 h-0.5 bg-[#D4A843]" />
                    <h3 className="text-xs font-bold text-[#1C3A2E] uppercase tracking-widest">{c.aboutTitle}</h3>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">{s.about}</p>
                </div>
                <div className="px-7 py-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-4 h-0.5 bg-[#D4A843]" />
                    <h3 className="text-xs font-bold text-[#1C3A2E] uppercase tracking-widest">{c.worksWithTitle}</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {s.specializations.map((spec, j) => (
                      <div key={j} className="flex items-center gap-2 p-2.5 bg-[#f4f9f4] rounded-xl">
                        <span className="text-base flex-shrink-0">{spec.icon}</span>
                        <p className="text-xs text-gray-700 font-medium leading-tight">{spec.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Ціна + кнопка */}
              <div className="lg:col-span-1 border-l border-gray-100 flex flex-col">
                <div className="h-1 bg-gradient-to-r from-[#D4A843] via-[#f0c040] to-[#D4A843]" />
                <div className="px-7 py-8 flex flex-col flex-1 justify-center gap-6">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-widest mb-2 font-medium">{c.costLabel}</p>
                    <p className="text-4xl font-bold text-[#1C3A2E] tracking-tight">{s.price}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-gray-100" />
                    <div className="w-1.5 h-1.5 bg-[#D4A843] rounded-full" />
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-widest mb-2 font-medium">{c.durationLabel}</p>
                    <p className="text-sm font-medium text-gray-500">{s.duration}</p>
                  </div>
                  <Link
                    href={s.calendlyUrl}
                    target="_blank"
                    className="block w-full bg-[#1C3A2E] text-white font-semibold py-4 rounded-xl text-center text-sm tracking-widest uppercase transition-all hover:bg-[#D4A843] hover:text-[#1C3A2E]"
                  >
                    {c.btnBook}
                  </Link>
                </div>
              </div>
            </div>

            {/* Освіта та кваліфікація */}
            <div className="border-t border-gray-100 px-8 py-8 bg-[#fafbfa]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-5 h-0.5 bg-[#D4A843]" />
                <h3 className="text-xs font-bold text-[#1C3A2E] uppercase tracking-widest">
                  {c.diplomasLabel}
                </h3>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <DiplomasSection content={{ sectionLabel: '', docs: s.diplomas }} />
            </div>

          </div>
        ))}

        {/* Placeholder-картки у форматі фахівця */}
        {[1, 2, 3].map((_, i) => (
          <div key={i} className="bg-white rounded-3xl shadow-sm overflow-hidden border-2 border-dashed border-gray-200">
            <div className="grid lg:grid-cols-3 gap-0">

              {/* Фото-заглушка */}
              <div className="lg:col-span-1 bg-gray-50 min-h-[280px] flex flex-col items-center justify-center gap-4 p-8">
                <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="8" r="4" fill="#d1d5db" />
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="text-center">
                  <div className="h-3 w-28 bg-gray-200 rounded-full mx-auto mb-2" />
                  <div className="h-2 w-20 bg-gray-100 rounded-full mx-auto" />
                </div>
              </div>

              {/* Про фахівця — заглушка */}
              <div className="lg:col-span-1 flex flex-col border-l border-gray-100">
                <div className="px-7 py-6 border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-4 h-0.5 bg-gray-200" />
                    <div className="h-2 w-24 bg-gray-200 rounded-full" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 bg-gray-100 rounded-full w-full" />
                    <div className="h-2 bg-gray-100 rounded-full w-5/6" />
                    <div className="h-2 bg-gray-100 rounded-full w-4/6" />
                  </div>
                </div>
                <div className="px-7 py-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-4 h-0.5 bg-gray-200" />
                    <div className="h-2 w-20 bg-gray-200 rounded-full" />
                  </div>
                  <div className="space-y-2">
                    {[1, 2, 3].map((_, j) => (
                      <div key={j} className="h-8 bg-gray-50 rounded-xl border border-gray-100" />
                    ))}
                  </div>
                </div>
              </div>

              {/* Ціна — заглушка */}
              <div className="lg:col-span-1 border-l border-gray-100 flex flex-col">
                <div className="h-1 bg-gray-200 w-full" />
                <div className="px-7 py-8 flex flex-col flex-1 justify-center items-center gap-6">
                  <div className="text-center">
                    <div className="h-2 w-16 bg-gray-200 rounded-full mx-auto mb-3" />
                    <div className="h-8 w-28 bg-gray-100 rounded-xl mx-auto" />
                  </div>
                  <div className="w-1.5 h-1.5 bg-gray-200 rounded-full" />
                  <div className="text-center w-full">
                    <div className="h-2 w-16 bg-gray-200 rounded-full mx-auto mb-3" />
                    <div className="h-4 w-20 bg-gray-100 rounded-full mx-auto" />
                  </div>
                  <div className="w-full rounded-xl border-2 border-dashed border-gray-200 py-4 flex flex-col items-center gap-1">
                    <p className="text-sm font-semibold text-gray-400">{c.soon}</p>
                    <p className="text-xs text-gray-300">{c.soonSubtitle}</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        ))}

      </div>
    </main>
  );
}