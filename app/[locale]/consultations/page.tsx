import Image from "next/image";
import { consultationsContent } from "./_content/uk";
import DiplomasSection from "@/components/home/DiplomasSection";
import { getTranslatedContent } from "@/lib/translate";

const getContent = getTranslatedContent(consultationsContent, 'consultations-page');

const ctaBtn = "block w-full bg-[#1C3A2E] text-white font-semibold py-4 rounded-xl text-center text-sm tracking-widest uppercase transition-all hover:bg-[#D4A843] hover:text-[#1C3A2E]";

export default async function ConsultationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);

  return (
    <main className="min-h-screen bg-[#f4f9f4]">

      <section className="bg-gradient-to-br from-[#1C3A2E] to-[#0f2219] text-white py-20">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-[#D4A843]/20 border border-[#D4A843]/30 text-[#D4A843] text-sm font-semibold px-5 py-2 rounded-full mb-6 tracking-wide uppercase">
            {"◆"} {c.hero.badge}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">{c.hero.title}</h1>
          <p className="text-white/60 text-lg max-w-xl mx-auto">{c.hero.subtitle}</p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-16 space-y-24">
        {c.specialists.map((s, i) => (
          <div key={i}>

            <div className="grid lg:grid-cols-2 gap-10 items-stretch mb-12">

              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#D4A843] to-[#1C3A2E] rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-700" />
                <div className="relative bg-white p-2 rounded-3xl shadow-2xl h-full">
                  <div className="relative h-full min-h-[480px] w-full rounded-2xl overflow-hidden">
                    <Image src={s.image} alt={s.name} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover object-top" priority />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="w-1 h-8 bg-[#D4A843] rounded-full" />
                        <p className="text-2xl font-bold">{s.name}</p>
                      </div>
                      <p className="text-white/70 text-sm pl-4">{s.role}</p>
                      <div className="flex items-center gap-2 mt-3 pl-4">
                        <div className="w-2 h-2 bg-[#D4A843] rounded-full" />
                        <p className="text-[#D4A843] text-sm font-medium">{s.experience}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-0 bg-white rounded-3xl shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-br from-[#1C3A2E] to-[#0f2219] px-8 pt-8 pb-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-[#D4A843]/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                  <div className="relative">
                    <div className="text-[#D4A843] text-5xl font-serif leading-none mb-3">{"\u201C"}</div>
                    <p className="text-white/90 text-base leading-relaxed italic">{s.quote}</p>
                    <div className="text-[#D4A843] text-5xl font-serif leading-none text-right mt-1">{"\u201D"}</div>
                  </div>
                </div>

                <div className="px-8 py-6 border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-0.5 bg-[#D4A843]" />
                    <h3 className="text-sm font-bold text-[#1C3A2E] uppercase tracking-widest">{c.aboutTitle}</h3>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">{s.about}</p>
                </div>

                <div className="px-8 py-6 flex-1">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-5 h-0.5 bg-[#D4A843]" />
                    <h3 className="text-sm font-bold text-[#1C3A2E] uppercase tracking-widest">{c.worksWithTitle}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {s.specializations.map((spec, j) => (
                      <div key={j} className="flex items-center gap-2 p-3 bg-[#f4f9f4] rounded-xl transition-all">
                        <span className="text-lg flex-shrink-0">{spec.icon}</span>
                        <p className="text-xs text-gray-700 font-medium leading-tight">{spec.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-lg p-8 mb-10">
              <DiplomasSection content={{ sectionLabel: c.diplomasLabel, docs: s.diplomas }} />
            </div>

            <div className="bg-white rounded-3xl shadow-lg p-8 mb-10">
              <h3 className="text-2xl font-bold text-[#1C3A2E] mb-6">{c.videosTitle}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {s.videos.map((video, j) => (
                  <div key={j} className="space-y-3">
                    <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black shadow-lg">
                      <iframe
                        src={"https://www.youtube.com/embed/" + video.videoId}
                        title={video.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="absolute inset-0 w-full h-full"
                      />
                    </div>
                    <p className="text-sm text-gray-700 font-medium">{video.title}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center">
              <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-[#D4A843] via-[#f0c040] to-[#D4A843]" />
                <div className="px-8 py-8">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-2 text-[#D4A843] text-xs font-bold uppercase tracking-widest mb-1">
                      {"◆ ◆ ◆"}
                    </div>
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">{c.btnBook}</p>
                  </div>
                  <div className="text-center mb-2">
                    <p className="text-xs text-gray-400 uppercase tracking-widest mb-1 font-medium">{c.costLabel}</p>
                    <p className="text-4xl font-bold text-[#1C3A2E] tracking-tight">{s.price}</p>
                  </div>
                  <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px bg-gray-100" />
                    <div className="w-1.5 h-1.5 bg-[#D4A843] rounded-full" />
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  <div className="text-center mb-7">
                    <p className="text-xs text-gray-400 uppercase tracking-widest mb-1 font-medium">{c.durationLabel}</p>
                    <p className="text-sm font-medium text-gray-500">{s.duration}</p>
                  </div>
                  <a href={s.calendlyUrl} target="_blank" rel="noopener noreferrer" className={ctaBtn}>
                    {c.btnBook}
                  </a>
                </div>
                <div className="h-0.5 bg-gradient-to-r from-transparent via-[#D4A843]/30 to-transparent" />
              </div>
            </div>

          </div>
        ))}

        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border-2 border-dashed border-gray-200 flex items-center justify-center p-10 text-center">
              <div>
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">{"👤"}</div>
                <p className="font-semibold text-gray-400">{c.soon}</p>
                <p className="text-sm text-gray-300 mt-1">{c.soonSubtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}