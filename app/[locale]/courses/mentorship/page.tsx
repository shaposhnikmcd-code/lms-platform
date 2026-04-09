import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { FaArrowRight, FaHeart, FaUsers, FaBookOpen, FaQuoteRight, FaQuoteLeft } from 'react-icons/fa';
import { Inter } from 'next/font/google';
import MentorshipPricing from './_components/MentorshipPricing';
import CoursePurchaseModal from '@/components/CoursePurchaseModal';
import { MENTORSHIP_COURSE } from './config';
import { getTranslatedContent } from '@/lib/translate';
import { content } from './_content/uk';
import BackButton from '@/components/BackButton';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });
const getContent = getTranslatedContent(content, 'mentorship-page', {
  en: () => import('./_content/en').then(m => m.default),
  pl: () => import('./_content/pl').then(m => m.default),
});

const resultIcons = [
  <FaUsers key={0} className="text-3xl text-[#D4A017]" />,
  <FaHeart key={1} className="text-3xl text-[#D4A017]" />,
  <FaBookOpen key={2} className="text-3xl text-[#D4A017]" />,
];

export default async function MentorshipCoursePage({ params }: { params: Promise<{ locale: string }> }) {
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
                  price={Number(MENTORSHIP_COURSE.price)}
                  courseId={MENTORSHIP_COURSE.courseId}
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
                  <Image src="/courses/mentorship/uimp_wide-logo.webp" alt="UIMP Logo" fill className="object-contain" priority />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{c.teacher.label}</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">{c.teacher.title}</h2>
        </div>
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="md:flex">
              <div className="md:w-1/3 relative h-56 md:h-auto">
                <Image src="/courses/mentorship/tetiana-shaposhnik.webp" alt={c.teacher.name} fill className="object-cover" />
              </div>
              <div className="p-6 md:w-2/3">
                <h3 className="text-xl font-bold text-[#1C3A2E] mb-1">{c.teacher.name}</h3>
                <p className="text-[#D4A017] text-sm mb-3">{c.teacher.role}</p>
                <p className="text-gray-600 text-sm leading-relaxed">{c.teacher.bio}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{c.results.label}</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">{c.results.title}</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {c.results.items.map((item, i) => (
            <div key={i} className="bg-[#FDF2EB] p-6 rounded-xl shadow-md hover:shadow-lg transition-all text-center">
              <div className="flex justify-center mb-4">{resultIcons[i]}</div>
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
                <h3 className="text-xl font-bold text-[#1C3A2E] mb-6">{section.title}</h3>
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

      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#FDF2EB] to-[#f5e6d8]" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 right-10 w-64 h-64 bg-[#D4A017] rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-64 h-64 bg-[#1C3A2E] rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4">
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 md:p-12 shadow-2xl border border-white">
            <div className="relative">
              <FaQuoteLeft className="absolute -top-4 -left-2 text-5xl text-[#D4A017] opacity-20" />
              <FaQuoteRight className="absolute -bottom-4 -right-2 text-5xl text-[#D4A017] opacity-20" />
            </div>
            <div className="relative z-10 text-center px-4 md:px-8">
              <p className="text-gray-700 text-base md:text-lg italic leading-relaxed mb-6">{c.quote.text}</p>
              <div className="w-24 h-0.5 bg-[#D4A017] mx-auto mb-4" />
              <p className="font-bold text-[#1C3A2E] text-lg">{c.quote.author}</p>
              <p className="text-[#D4A017] text-sm">{c.quote.role}</p>
            </div>
          </div>
        </div>
      </section>

      <MentorshipPricing locale={locale} />

          <BackButton href="/courses" label="Повернутись до освітніх проєктів" />
    </main>
  );
}