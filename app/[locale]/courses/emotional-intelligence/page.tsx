import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { FaArrowRight, FaBrain, FaUsers, FaHeart, FaCross, FaBookOpen } from 'react-icons/fa';
import { Inter } from 'next/font/google';
import EmotionalIntelligencePricing from './_components/EmotionalIntelligencePricing';
import CoursePurchaseModal from '@/components/CoursePurchaseModal';
import { EMOTIONAL_INTELLIGENCE_COURSE } from './config';
import { getTranslatedContent } from '@/lib/translate';
import { content } from './_content/uk';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });
const getContent = getTranslatedContent(content, 'emotional-intelligence-page');

const audienceIcons = [
  <FaBrain key={0} className="text-3xl text-[#D4A017]" />,
  <FaUsers key={1} className="text-3xl text-[#D4A017]" />,
  <FaHeart key={2} className="text-3xl text-[#D4A017]" />,
  <FaCross key={3} className="text-3xl text-[#D4A017]" />,
  <FaBookOpen key={4} className="text-3xl text-[#D4A017]" />,
];

export default async function EmotionalIntelligencePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);

  return (
    <main className={`min-h-screen bg-white ${inter.className}`}>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-20 w-72 h-72 bg-[#D4A017] rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Link href="/courses" className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm mb-6">
            ← Освітні проєкти
          </Link>
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="inline-block px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm">
                {c.badge}
              </div>
              <h1 className="text-5xl md:text-7xl font-bold leading-[1.1]">
                {c.title1}<br />{c.title2}
              </h1>
              <p className="text-white/80 text-lg leading-relaxed max-w-xl">{c.description}</p>
              <div className="flex flex-col sm:flex-row gap-4">
                <CoursePurchaseModal
                  courseName="Емоційний інтелект"
                  price={Number(EMOTIONAL_INTELLIGENCE_COURSE.price)}
                  courseId={EMOTIONAL_INTELLIGENCE_COURSE.courseId}
                  buttonLabel={c.btnBuy}
                />
                <Link href="#program"
                  className="inline-flex items-center justify-center px-8 py-4 border border-white/30 rounded-lg hover:bg-white/10 transition-all font-medium">
                  {c.btnProgram}
                </Link>
              </div>
              <div className="flex items-center gap-6 pt-4">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-[#D4A017] border-2 border-white" />
                  ))}
                </div>
                <p className="text-sm text-white/60">
                  <span className="text-white font-bold">{c.studentsCount}</span>{" "}{c.students}
                </p>
              </div>
            </div>
            <div className="relative">
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

      {/* Audience */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-center mb-8">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{c.audience.label}</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">{c.audience.title}</h2>
        </div>
        <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-6">
          {c.audience.items.map((item, i) => (
            <div key={i} className="bg-[#FDF2EB] p-6 rounded-xl shadow-md hover:shadow-lg transition-all text-center">
              <div className="flex justify-center mb-4">{audienceIcons[i]}</div>
              <p className="text-gray-700 text-sm">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Results */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-center mb-8">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{c.results.label}</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">{c.results.title}</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {c.results.items.map((item, i) => (
            <div key={i} className="relative p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-all border border-gray-100">
              <div className="absolute -top-3 -left-3 w-10 h-10 bg-[#D4A017] rounded-full flex items-center justify-center text-white font-bold text-lg">
                {item.number}
              </div>
              <div className="pt-4">
                <h3 className="text-lg font-bold text-[#1C3A2E] mb-3">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How learning works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-center mb-8">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{c.learning.label}</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">{c.learning.title}</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {c.learning.items.map((item, i) => (
            <div key={i} className="bg-[#FDF2EB] p-8 rounded-xl shadow-md text-center">
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="text-lg font-bold text-[#1C3A2E] mb-3">{item.title}</h3>
              <p className="text-gray-600 text-sm">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Teacher */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-center mb-8">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{c.teachers.label}</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">{c.teachers.title}</h2>
        </div>
        <div className="max-w-md mx-auto">
          {c.teachers.items.map((teacher, i) => (
            <div key={i} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all overflow-hidden group">
              <div className="relative w-full overflow-hidden bg-[#f5f0eb]">
                <Image src={teacher.image} alt={teacher.name} width={853} height={1280} unoptimized
                  className="h-auto transition-transform duration-500"
                  style={{
                    marginTop: '-30%',
                    marginBottom: '-2%',
                    width: '120%',
                    maxWidth: 'none',
                    marginLeft: '-5%',
                  }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <h3 className="text-xl font-bold mb-1">{teacher.name}</h3>
                  <p className="text-white/90 text-sm">{teacher.role}</p>
                </div>
              </div>
              {teacher.description && (
                <div className="p-5">
                  <p className="text-[#1C3A2E]/80 text-sm leading-relaxed italic">{teacher.description}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Program */}
      <section id="program" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-center mb-8">
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

      {/* Pricing */}
      <EmotionalIntelligencePricing locale={locale} />

    </main>
  );
}
