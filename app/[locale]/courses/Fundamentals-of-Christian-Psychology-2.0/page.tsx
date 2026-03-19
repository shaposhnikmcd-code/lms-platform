import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { FaArrowRight, FaHeart, FaUsers, FaBookOpen, FaPray, FaCrown, FaCalendarAlt } from 'react-icons/fa';
import { FaBrain } from 'react-icons/fa';
import { Inter } from 'next/font/google';
import CoursePricingTiers from './_components/CoursePricingTiers';
import { getTranslatedContent } from '@/lib/translate';
import { content } from './_content/uk';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });
const getContent = getTranslatedContent(content, 'christian-psychology-page');

const topicIcons = [
  <FaPray key={0} className="text-2xl text-[#D4A017]" />,
  <FaHeart key={1} className="text-2xl text-[#D4A017]" />,
  <FaBrain key={2} className="text-2xl text-[#D4A017]" />,
  <FaUsers key={3} className="text-2xl text-[#D4A017]" />,
];

export default async function ChristianPsychologyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);

  return (
    <main className={`min-h-screen bg-white ${inter.className}`}>

      <section className="relative overflow-hidden bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-20 w-72 h-72 bg-[#D4A017] rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="inline-block px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm">
                {c.badge}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold leading-[1.1]">
                {c.title1}<br />{c.title2}<br />{c.title3}
              </h1>
              <p className="text-white/80 text-lg leading-relaxed max-w-xl">{c.description}</p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="#price"
                  className="group inline-flex items-center justify-center gap-2 bg-[#D4A017] text-white font-bold px-10 py-4 rounded-lg hover:bg-[#b88913] transition-all duration-300 text-lg">
                  <span>{c.btnBuy}</span>
                  <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
                </Link>
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
                  <Image src="/courses/Fundamentals-of-Christian-Psychology-2.0/uimp_wide-logo.webp" alt="UIMP Logo" fill className="object-contain" priority />
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
              <div className="md:w-1/3 relative h-64 md:h-auto">
                <Image src="/courses/Fundamentals-of-Christian-Psychology-2.0/tetiana-shaposhnik.webp" alt={c.teacher.name} fill className="object-cover" />
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
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{c.topics.label}</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">{c.topics.title}</h2>
          <p className="text-gray-500 text-sm mt-2">{c.topics.subtitle}</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {c.topics.items.map((item, i) => (
            <div key={i} className="bg-[#FDF2EB] p-5 rounded-xl shadow-md hover:shadow-lg transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white rounded-lg">{topicIcons[i]}</div>
                <h3 className="font-bold text-[#1C3A2E]">{item.title}</h3>
              </div>
              <p className="text-gray-600 text-sm">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-r from-[#1C3A2E] to-[#2a4f3f] rounded-2xl p-8 md:p-10 text-white">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <h2 className="text-2xl md:text-3xl font-bold">{c.activity.title}</h2>
              <p className="text-white/80 text-sm leading-relaxed">{c.activity.text1}</p>
              <p className="text-white/80 text-sm leading-relaxed">{c.activity.text2}</p>
              <p className="text-white font-medium text-sm mt-4">{c.activity.highlight}</p>
            </div>
            <div className="flex justify-center">
              <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl border border-white/20">
                <FaUsers className="text-6xl text-[#D4A017] mx-auto" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="program" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{c.program.label}</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">{c.program.title}</h2>
        </div>
        <div className="space-y-8">
          {c.program.weeks.map((week, wi) => (
            <div key={wi}>
              <h3 className="text-xl font-bold text-[#1C3A2E] mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-[#D4A017] rounded-full" />
                {week.title}
              </h3>
              <div className="space-y-2">
                {week.lessons.map((lesson, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-[#FDF2EB] transition-all">
                    <div className="min-w-[90px] text-[#D4A017] font-medium text-sm flex items-center gap-1">
                      <FaCalendarAlt className="text-xs" />
                      {lesson.date}
                    </div>
                    <p className="text-gray-700 text-sm">{lesson.title}</p>
                  </div>
                ))}
                <div className="mt-2 p-3 bg-[#D4A017]/10 rounded-lg border border-[#D4A017]/20">
                  <p className="text-[#1C3A2E] font-medium text-sm flex items-center gap-2">
                    <FaUsers className="text-[#D4A017] flex-shrink-0" />
                    <span>{week.practice}</span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <CoursePricingTiers locale={locale} />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-r from-[#1C3A2E] to-[#2a4f3f] rounded-2xl p-8 md:p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">{c.cta.title}</h2>
          <p className="text-white/80 text-sm mb-6 max-w-xl mx-auto">{c.cta.subtitle}</p>
          <Link href="#price"
            className="inline-block bg-[#D4A017] text-white font-bold py-3 px-8 rounded-lg hover:bg-[#b88913] transition-all">
            {c.cta.btn}
          </Link>
        </div>
      </section>

    </main>
  );
}