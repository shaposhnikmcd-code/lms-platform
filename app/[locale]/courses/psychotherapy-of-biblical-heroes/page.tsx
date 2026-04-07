import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { FaArrowRight, FaBookOpen, FaPray, FaCrown } from 'react-icons/fa';
import { Inter } from 'next/font/google';
import BiblicalHeroesPricing from './_components/BiblicalHeroesPricing';
import CoursePurchaseModal from '@/components/CoursePurchaseModal';
import { BIBLICAL_HEROES_COURSE } from './config';
import { getTranslatedContent } from '@/lib/translate';
import { content } from './_content/uk';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });
const getContent = getTranslatedContent(content, 'biblical-heroes-page', {
  en: () => import('./_content/en').then(m => m.default),
  pl: () => import('./_content/pl').then(m => m.default),
});

const aboutIcons = [
  <FaBookOpen key={0} className="text-3xl text-[#D4A017]" />,
  <FaCrown key={1} className="text-3xl text-[#D4A017]" />,
  <FaPray key={2} className="text-3xl text-[#D4A017]" />,
];

export default async function BiblicalHeroesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);

  return (
    <main className={`min-h-screen bg-white ${inter.className}`}>

      <section className="relative overflow-hidden bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-20 w-72 h-72 bg-[#D4A017] rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          <Link href="/courses" className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm mb-3">
            ← Освітні проєкти
          </Link>
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div className="space-y-3">
              <div className="inline-block px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm">
                {c.badge}
              </div>
              <h1 className="text-5xl md:text-7xl font-bold leading-[1.1]">
                {c.title1}<br />{c.title2}
              </h1>
              <p className="text-white/80 text-base leading-relaxed max-w-xl">{c.description}</p>
              <div className="flex flex-col sm:flex-row gap-3 !mt-4">
                <CoursePurchaseModal
                  courseName={`${c.title1} ${c.title2}`}
                  price={Number(BIBLICAL_HEROES_COURSE.price)}
                  courseId={BIBLICAL_HEROES_COURSE.courseId}
                  buttonLabel={c.btnBuy}
                />
                <Link href="#program"
                  className="inline-flex items-center justify-center px-6 py-3 border border-white/30 rounded-lg hover:bg-white/10 transition-all font-medium">
                  {c.btnProgram}
                </Link>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-7 h-7 rounded-full bg-[#D4A017] border-2 border-white" />
                  ))}
                </div>
                <p className="text-sm text-white/60">
                  <span className="text-white font-bold">{c.studentsCount}</span>{" "}{c.students}
                </p>
              </div>
            </div>
            <div className="relative scale-90 origin-center">
              <div className="absolute inset-0 bg-gradient-to-r from-[#D4A017] to-[#b88913] rounded-2xl rotate-3 opacity-20" />
              <div className="relative bg-white/10 backdrop-blur-sm p-8 rounded-2xl border border-white/20">
                <div className="relative h-48">
                  <Image src="/courses/psychotherapy-of-biblical-heroes/uimp_wide-logo-bible.webp" alt={`${c.title1} ${c.title2}`} fill className="object-contain" priority />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{c.about.label}</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">{c.about.title}</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {c.about.items.map((item, i) => (
            <div key={i} className="bg-[#FDF2EB] p-6 rounded-xl shadow-md hover:shadow-lg transition-all text-center">
              <div className="flex justify-center mb-4">{aboutIcons[i]}</div>
              <p className="text-gray-700 text-sm">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="program" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{c.program.label}</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">{c.program.title}</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {c.program.sections.map((section, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all overflow-hidden">
              <div className={`h-2 bg-gradient-to-r ${section.color}`} />
              <div className="p-8">
                <h3 className="text-xl font-bold text-[#1C3A2E] mb-1">{section.title}</h3>
                <p className="text-[#D4A017] text-xs mb-6">{section.subtitle}</p>
                <ul className="space-y-3">
                  {section.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-3 text-gray-600">
                      <span className="w-6 h-6 bg-[#FDF2EB] rounded-full flex items-center justify-center text-[#D4A017] font-bold text-sm flex-shrink-0">
                        {j + 1}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      <BiblicalHeroesPricing locale={locale} />

    </main>
  );
}