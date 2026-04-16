import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { FaCheck, FaStar } from 'react-icons/fa';
import BackButton from '@/components/BackButton';
import { Inter } from 'next/font/google';
import PsychologyPricing from './_components/PsychologyPricing';
import CoursePurchaseModal from '@/components/CoursePurchaseModal';
import { PSYCHOLOGY_COURSE } from './config';
import { getTranslatedContent } from '@/lib/translate';
import { getCoursePriceInfo } from '@/lib/coursePrice';
import { content } from './_content/uk';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });
const getContent = getTranslatedContent(content, 'psychology-basics-page', {
  en: () => import('./_content/en').then(m => m.default),
  pl: () => import('./_content/pl').then(m => m.default),
});

export const dynamic = 'force-dynamic';

export default async function PsychologyBasicsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);
  const { price, oldPrice } = await getCoursePriceInfo(
    'psychology-basics',
    Number(PSYCHOLOGY_COURSE.price),
    PSYCHOLOGY_COURSE.priceOld ? Number(PSYCHOLOGY_COURSE.priceOld) : null,
  );

  return (
    <main className={`min-h-screen bg-white ${inter.className}`}>

      <BackButton href="/courses" label="Повернутись до освітніх проєктів" />

      <section className="relative overflow-hidden bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-white rounded-full mix-blend-multiply filter blur-xl" style={{ animation: 'blob 7s infinite' }} />
          <div className="absolute top-0 -right-4 w-72 h-72 bg-[#D4A017] rounded-full mix-blend-multiply filter blur-xl" style={{ animation: 'blob 7s infinite', animationDelay: '2s' }} />
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
                  price={price}
                  courseId={PSYCHOLOGY_COURSE.courseId}
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
                  <Image src="/courses/psychology-basics/uimp_wide-logo.webp" alt="UIMP Logo" fill className="object-contain" priority />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{c.benefits.label}</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">{c.benefits.title}</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {c.benefits.items.map((item, i) => (
            <div key={i} className="group relative bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-[#1C3A2E]/5 to-transparent rounded-2xl" />
              <div className="relative">
                <div className="text-5xl mb-6">{item.icon}</div>
                <h3 className="text-xl font-bold text-[#1C3A2E] mb-3">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#FDF2EB] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{c.audience.label}</span>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">{c.audience.title}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {c.audience.items.map((item, i) => (
              <div key={i} className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-bold text-[#1C3A2E] mb-3">{item.title}</h3>
                <p className="text-gray-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid md:grid-cols-3 gap-8">
          {c.uniqueness.map((item, i) => (
            <div key={i} className="relative">
              <div className="text-8xl font-black text-[#1C3A2E]/5 absolute -top-6 -left-4">{item.number}</div>
              <div className="relative pt-12">
                <h3 className="text-2xl font-bold text-[#1C3A2E] mb-4">{item.title}</h3>
                <p className="text-gray-600 mb-4">{item.text}</p>
                {item.list && (
                  <ul className="space-y-2">
                    {item.list.map((li, j) => (
                      <li key={j} className="flex items-start gap-2">
                        <FaCheck className="text-[#D4A017] mt-1 flex-shrink-0" />
                        <span className="text-gray-600 text-sm">{li}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#1C3A2E] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{c.teachers.label}</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">{c.teachers.title}</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {c.teachers.items.map((teacher, i) => (
              <div key={i} className="group relative bg-white rounded-2xl overflow-hidden shadow-2xl transition-all duration-500">
                <div className="relative h-[500px] w-full overflow-hidden">
                  <Image src={`/courses/psychology-basics/${teacher.image}.webp`} alt={teacher.name} fill
                    className="object-contain object-top group-hover:scale-110 transition-transform duration-700"
                    sizes="(max-width: 768px) 100vw, 50vw" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                    <div className="inline-block px-3 py-1 bg-[#D4A017] rounded-full text-xs mb-4">{teacher.stats}</div>
                    <h3 className="text-3xl font-bold mb-2">{teacher.name}</h3>
                    <p className="text-white/90 text-lg mb-1">{teacher.role}</p>
                    <p className="text-white/70">{teacher.subtitle}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="program" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{c.program.label}</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">{c.program.title}</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {c.program.sections.map((section, i) => (
            <div key={i} className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all overflow-hidden">
              <div className={`h-2 bg-gradient-to-r ${section.color}`} />
              <div className="p-8">
                <h3 className="text-2xl font-bold text-[#1C3A2E] mb-6">{section.title}</h3>
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

      <section className="bg-[#FDF2EB] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{c.reviews.label}</span>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">{c.reviews.title}</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {c.reviews.items.map((review, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl shadow-md hover:shadow-xl transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <Image src={`/courses/psychology-basics/${review.image}.webp`} alt={review.name} fill className="object-cover rounded-full" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#1C3A2E]">{review.name}</p>
                    <div className="flex gap-1">
                      {[...Array(review.rating)].map((_, j) => (
                        <FaStar key={j} className="text-[#D4A017] text-xs" />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">{`"${review.text}"`}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PsychologyPricing locale={locale} price={price} oldPrice={oldPrice} />

    </main>
  );
}