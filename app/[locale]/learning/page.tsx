import Link from 'next/link';
import Image from 'next/image';
import { FaGraduationCap, FaCheckCircle, FaArrowRight, FaStar, FaQuoteLeft, FaChevronRight } from 'react-icons/fa';
import { Inter } from 'next/font/google';
import { getTranslatedContent } from '@/lib/translate';
import { learningContent } from './_content/uk';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });
const SENDPULSE_URL = 'https://uimp-edu.sendpulse.online/bible-therapy';

const getContent = getTranslatedContent(learningContent, 'learning-page');

export default async function LearningPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);

  return (
    <main className={`min-h-screen bg-white ${inter.className}`}>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 -left-4 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#D4A017] rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="inline-block px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm">
                {c.badge}
              </div>
              <h1 className="text-5xl md:text-7xl font-bold leading-[1.05]">
                {c.title1}<br />
                <span className="text-[#D4A017]">{c.title2}</span>
              </h1>
              <p className="text-white/80 text-lg leading-relaxed max-w-xl">{c.description}</p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a href={SENDPULSE_URL} target="_blank" rel="noopener noreferrer"
                  className="group inline-flex items-center justify-center gap-2 bg-[#D4A017] text-white font-bold px-10 py-4 rounded-lg hover:bg-[#b88913] transition-all text-lg">
                  <span>{c.btnEnroll}</span>
                  <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
                </a>
                <Link href="#modules"
                  className="inline-flex items-center justify-center px-8 py-4 border border-white/30 rounded-lg hover:bg-white/10 transition-all font-medium">
                  {c.btnProgram}
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                {c.stats.map((s, i) => (
                  <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
                    <div className="text-2xl font-black text-[#D4A017]">{s.value}</div>
                    <div className="text-white/60 text-xs mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#D4A017] to-[#b88913] rounded-2xl rotate-3 opacity-20" />
              <div className="relative bg-white/10 backdrop-blur-sm p-8 rounded-2xl border border-white/20 space-y-4">
                <div className="relative h-48">
                  <Image src="/courses/psychology-basics/uimp_wide-logo.webp.webp" alt="UIMP Logo" fill className="object-contain" priority />
                </div>
                <div className="border-t border-white/20 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/70 text-sm">{c.monthlyPayment}</span>
                    <span className="text-[#D4A017] font-black text-2xl">{c.price}</span>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white/70 text-sm">{c.durationLabel}</span>
                    <span className="text-white font-semibold">{c.duration}</span>
                  </div>
                  <a href={SENDPULSE_URL} target="_blank" rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 bg-[#D4A017] text-white font-bold px-6 py-3 rounded-lg hover:bg-[#b88913] transition-all">
                    {c.enrollNow}
                    <FaArrowRight />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quote */}
      <section className="bg-[#FDF2EB] py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <FaQuoteLeft className="text-[#D4A017] text-4xl mx-auto mb-6 opacity-40" />
          <p className="text-xl md:text-2xl text-[#1C3A2E] font-medium leading-relaxed italic mb-6">{c.quote.text}</p>
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-0.5 bg-[#D4A017]" />
            <span className="font-bold text-[#1C3A2E]">{c.quote.author}</span>
            <span className="text-[#D4A017] text-sm">{c.quote.role}</span>
            <div className="w-10 h-0.5 bg-[#D4A017]" />
          </div>
        </div>
      </section>

      {/* Format */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{c.format.label}</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">{c.format.title}</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {c.format.items.map((item, i) => (
            <div key={i} className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all border border-gray-100 hover:border-[#D4A017]/30">
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="text-lg font-bold text-[#1C3A2E] mb-3">{item.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Teacher */}
      <section className="bg-[#1C3A2E] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{c.teacher.label}</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">{c.teacher.title}</h2>
          </div>
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="md:flex">
                <div className="md:w-1/3 relative h-64 md:h-auto">
                  <Image src="/courses/psychiatry-basics/tetiana-shaposhnik.webp" alt={c.teacher.name} fill className="object-cover" />
                </div>
                <div className="p-8 md:w-2/3">
                  <div className="flex items-center gap-2 mb-2">
                    {[1,2,3,4,5].map(i => <FaStar key={i} className="text-[#D4A017] text-sm" />)}
                  </div>
                  <h3 className="text-2xl font-bold text-[#1C3A2E] mb-1">{c.teacher.name}</h3>
                  <p className="text-[#D4A017] text-sm mb-4">{c.teacher.role}</p>
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">{c.teacher.bio}</p>
                  <div className="flex flex-wrap gap-2">
                    {c.teacher.tags.map((tag, i) => (
                      <span key={i} className="bg-[#FDF2EB] text-[#1C3A2E] text-xs px-3 py-1 rounded-full font-medium">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{c.modules.label}</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">{c.modules.title}</h2>
          <p className="text-gray-500 mt-2">{c.modules.subtitle}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {c.modules.items.map((mod, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all overflow-hidden border border-gray-100">
              <div className={`h-1.5 bg-gradient-to-r ${mod.color}`} />
              <div className="p-8">
                <div className="flex items-start gap-4 mb-6">
                  <span className="text-5xl font-black text-[#1C3A2E]/10 leading-none flex-shrink-0">{mod.number}</span>
                  <h3 className="text-base font-bold text-[#1C3A2E] leading-snug pt-1">{mod.title}</h3>
                </div>
                <ul className="space-y-2">
                  {mod.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-3 text-gray-600">
                      <FaChevronRight className="text-[#D4A017] text-xs mt-1 flex-shrink-0" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Outcomes */}
      <section className="bg-[#FDF2EB] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{c.outcomes.label}</span>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">{c.outcomes.title}</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {c.outcomes.items.map((o, i) => (
              <div key={i} className="flex items-start gap-3 bg-white p-5 rounded-xl shadow-sm border border-white hover:border-[#D4A017]/30 transition-all hover:shadow-md">
                <FaCheckCircle className="text-[#D4A017] text-xl flex-shrink-0 mt-0.5" />
                <p className="text-gray-700 text-sm">{o}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{c.steps.label}</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">{c.steps.title}</h2>
        </div>
        <div className="relative">
          <div className="absolute top-6 left-0 right-0 h-0.5 bg-[#D4A017]/20 hidden lg:block" />
          <div className="grid md:grid-cols-5 gap-6 relative">
            {c.steps.items.map((s, i) => (
              <div key={i} className="text-center relative">
                <div className="w-12 h-12 bg-[#1C3A2E] text-white rounded-full flex items-center justify-center font-bold mx-auto mb-4 relative z-10">
                  {s.step}
                </div>
                <h3 className="font-bold text-[#1C3A2E] mb-2 text-sm">{s.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="relative bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] rounded-3xl overflow-hidden p-12 md:p-16">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-96 h-96 bg-[#D4A017] rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
          </div>
          <div className="relative text-center">
            <FaGraduationCap className="text-[#D4A017] text-6xl mx-auto mb-6" />
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">{c.cta.title}</h2>
            <p className="text-white/70 text-lg mb-4 max-w-lg mx-auto">{c.cta.monthlyPayment}</p>
            <div className="text-[#D4A017] text-5xl font-black mb-8">{c.price}</div>
            <div className="flex flex-wrap justify-center gap-4">
              <a href={SENDPULSE_URL} target="_blank" rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 bg-[#D4A017] text-white font-bold px-10 py-4 rounded-lg hover:bg-[#b88913] transition-all text-lg">
                {c.cta.btnEnroll}
                <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
              </a>
              <a href="https://t.me/shaposhnykpsy" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-white/30 text-white px-8 py-4 rounded-lg hover:bg-white/10 transition-all">
                {c.cta.btnTelegram}
              </a>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}