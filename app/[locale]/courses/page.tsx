import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PSYCHIATRY_COURSE } from './psychiatry-basics/config';
import { PSYCHOLOGY_COURSE } from './psychology-basics/config';
import { MENTORSHIP_COURSE } from './mentorship/config';
import { BIBLICAL_HEROES_COURSE } from './psychotherapy-of-biblical-heroes/config';
import { SEX_EDUCATION_COURSE } from './sex-education/config';
import { getCurrency } from '@/lib/currency';

const icons: Record<string, string> = {
  psychology: '🧠',
  support: '🤝',
  psychiatry: '⚕️',
  mentorship: '🫂',
  christianPsy: '✝️',
  biblicalHeroes: '📖',
  sexEd: '👨‍👩‍👧',
  porn: '💪',
};

export default async function CoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('CoursesPage');
  const currency = getCurrency(locale);

  const courses = [
    { key: 'psychology', price: PSYCHOLOGY_COURSE.price, href: '/courses/psychology-basics' },
    { key: 'psychiatry', price: PSYCHIATRY_COURSE.price, href: '/courses/psychiatry-basics' },
    { key: 'mentorship', price: MENTORSHIP_COURSE.price, href: '/courses/mentorship' },
    { key: 'christianPsy', price: '4200', href: '/courses/Fundamentals-of-Christian-Psychology-2.0' },
    { key: 'biblicalHeroes', price: BIBLICAL_HEROES_COURSE.price, href: '/courses/psychotherapy-of-biblical-heroes' },
    { key: 'sexEd', price: SEX_EDUCATION_COURSE.price, href: '/courses/sex-education' },
  ];

  const charityCourses = [
    { key: 'support', href: '/courses/psychological-support', external: false },
    { key: 'porn', href: 'https://t.me/zhyty_chysto_2_bot', external: true },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b3d2e] to-[#022d23] p-4">
      <div className="container mx-auto max-w-5xl">

        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{t('title')}</h1>
          <p className="text-[#e7e2c6]">{t('subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {courses.map((course, index) => (
            <Link
              key={course.key}
              href={course.href}
              className="bg-[#003d30] rounded-2xl p-5 hover:shadow-xl transition-all duration-300 border border-[#1a5a48] group hover:scale-105 hover:shadow-2xl"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex flex-col h-full">
                <div className="mb-3">
                  <span className="text-3xl filter drop-shadow-lg">{icons[course.key] ?? '📚'}</span>
                </div>
                <h2 className="text-[#e7e2c6] text-lg font-bold mb-2 group-hover:text-white transition-colors">
                  {t(`courses.${course.key}.title`)}
                </h2>
                <p className="text-[#CFC8A9] text-xs mb-4 flex-grow group-hover:text-[#e7e2c6] transition-colors">
                  {t(`courses.${course.key}.description`)}
                </p>
                <div className="flex justify-between items-center text-sm border-t border-[#1a5a48] pt-3 mt-auto group-hover:border-[#D4A017] transition-colors">
                  <span className="text-[#e7e2c6] font-semibold group-hover:text-[#D4A017] transition-colors">
                    {course.price} {currency}
                  </span>
                  <span className="text-[#CFC8A9] text-xs group-hover:text-white transition-colors">
                    {t(`courses.${course.key}.duration`)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mb-8">
          <div className="text-center mb-6">
            <span className="inline-block px-4 py-1 bg-[#D4A017]/20 text-[#D4A017] rounded-full text-sm font-medium mb-3">
              {t('charityBadge')}
            </span>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{t('charityTitle')}</h2>
            <p className="text-[#e7e2c6] text-sm">{t('charitySubtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {charityCourses.map((course, index) => {
              const Tag = course.external ? 'a' : Link;
              const extraProps = course.external ? { target: '_blank', rel: 'noopener noreferrer' } : {};
              return (
                <Tag
                  key={course.key}
                  href={course.href}
                  {...extraProps}
                  className="bg-[#D4A017]/10 rounded-2xl p-5 hover:shadow-xl transition-all duration-300 border border-[#D4A017]/30 group hover:scale-105 hover:border-[#D4A017]"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex flex-col h-full">
                    <div className="mb-3">
                      <span className="text-3xl filter drop-shadow-lg">{icons[course.key] ?? '📚'}</span>
                    </div>
                    <h2 className="text-[#e7e2c6] text-lg font-bold mb-2 group-hover:text-white transition-colors">
                      {t(`courses.${course.key}.title`)}
                    </h2>
                    <p className="text-[#CFC8A9] text-xs mb-4 flex-grow group-hover:text-[#e7e2c6] transition-colors">
                      {t(`courses.${course.key}.description`)}
                    </p>
                    <div className="flex justify-between items-center text-sm border-t border-[#D4A017]/30 pt-3 mt-auto group-hover:border-[#D4A017] transition-colors">
                      <span className="text-[#D4A017] font-semibold">
                        {t(`courses.${course.key}.price`)}
                      </span>
                      <span className="text-[#CFC8A9] text-xs group-hover:text-white transition-colors">
                        {t(`courses.${course.key}.duration`)}
                      </span>
                    </div>
                  </div>
                </Tag>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}