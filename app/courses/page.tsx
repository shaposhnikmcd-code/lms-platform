import Link from 'next/link';
import { PSYCHIATRY_COURSE } from './psychiatry-basics/config';
import { PSYCHOLOGY_COURSE } from './psychology-basics/config';
import { MENTORSHIP_COURSE } from './mentorship/config';

const courses = [
  { id: 1, title: 'Основи психології', description: 'Вступ до психології: базові концепції, теорії та методи', price: PSYCHOLOGY_COURSE.price, duration: '2 місяці', href: '/courses/psychology-basics', external: false },
  { id: 3, title: 'Основи психіатрії', description: 'Вступ до психіатрії для психологів та душеопікунів', price: PSYCHIATRY_COURSE.price, duration: '4 місяці', href: '/courses/psychiatry-basics', external: false },
  { id: 4, title: 'Основи душеопікунства', description: 'Навчання основам душеопікунства та пастирського консультування', price: MENTORSHIP_COURSE.price, duration: '3 місяці', href: '/courses/mentorship', external: false },
  { id: 5, title: 'Основи християнської психології 2.0', description: 'Поглиблений курс з християнської психології для практикуючих психологів', price: '4200 грн', duration: '4 місяці', href: '/courses/Fundamentals-of-Christian-Psychology-2.0', external: false },
  { id: 6, title: 'Психотерапія біблійних героїв', description: 'Аналіз біблійних персонажів з точки зору психотерапії', price: '1400 грн', duration: '3 місяці', href: '/courses/psychotherapy-of-biblical-heroes', external: false },
  { id: 7, title: 'Статеве виховання', description: 'Курс з статевого виховання для психологів та педагогів', price: '2900 грн', duration: '2 місяці', href: '/courses/sex-education', external: false },
];

const charityCourses = [
  { id: 2, title: 'Курс психологічної підтримки', description: 'Базовий курс для психологів та всіх, хто хоче навчитися надавати психологічну підтримку', price: 'Безкоштовно', duration: '3 місяці', href: '/courses/psychological-support', external: false },
  { id: 8, title: 'Курс боротьби з порнозалежністю', description: 'Спеціалізований курс з подолання порнозалежності', price: 'Безкоштовно', duration: '3 місяці', href: 'https://t.me/zhyty_chysto_2_bot', external: true },
];

const icons: Record<number, string> = {
  1: '🧠', 2: '🤝', 3: '⚕️', 4: '🫂', 5: '✝️', 6: '📖', 7: '👨‍👩‍👧', 8: '💪',
};

export default function CoursesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b3d2e] to-[#022d23] p-4">
      <div className="container mx-auto max-w-5xl">

        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            {"Навчальні курси"}
          </h1>
          <p className="text-[#e7e2c6]">
            {"Оберіть курс для професійного та особистісного зростання"}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {courses.map((course, index) => (
            <Link
              key={course.id}
              href={course.href}
              className="bg-[#003d30] rounded-2xl p-5 hover:shadow-xl transition-all duration-300 border border-[#1a5a48] group hover:scale-105 hover:shadow-2xl"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex flex-col h-full">
                <div className="mb-3">
                  <span className="text-3xl filter drop-shadow-lg">{icons[course.id] ?? '📚'}</span>
                </div>
                <h2 className="text-[#e7e2c6] text-lg font-bold mb-2 group-hover:text-white transition-colors">
                  {course.title}
                </h2>
                <p className="text-[#CFC8A9] text-xs mb-4 flex-grow group-hover:text-[#e7e2c6] transition-colors">
                  {course.description}
                </p>
                <div className="flex justify-between items-center text-sm border-t border-[#1a5a48] pt-3 mt-auto group-hover:border-[#D4A017] transition-colors">
                  <span className="text-[#e7e2c6] font-semibold group-hover:text-[#D4A017] transition-colors">
                    {course.price}
                  </span>
                  <span className="text-[#CFC8A9] text-xs group-hover:text-white transition-colors">
                    {course.duration}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mb-8">
          <div className="text-center mb-6">
            <span className="inline-block px-4 py-1 bg-[#D4A017]/20 text-[#D4A017] rounded-full text-sm font-medium mb-3">
              {"🎁 Безкоштовно"}
            </span>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
              {"Благодійні курси"}
            </h2>
            <p className="text-[#e7e2c6] text-sm">
              {"Курси, які ми надаємо безкоштовно для всіх охочих"}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {charityCourses.map((course, index) => {
              const Tag = course.external ? 'a' : Link;
              const extraProps = course.external
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {};
              return (
                <Tag
                  key={course.id}
                  href={course.href}
                  {...extraProps}
                  className="bg-[#D4A017]/10 rounded-2xl p-5 hover:shadow-xl transition-all duration-300 border border-[#D4A017]/30 group hover:scale-105 hover:border-[#D4A017]"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex flex-col h-full">
                    <div className="mb-3">
                      <span className="text-3xl filter drop-shadow-lg">{icons[course.id] ?? '📚'}</span>
                    </div>
                    <h2 className="text-[#e7e2c6] text-lg font-bold mb-2 group-hover:text-white transition-colors">
                      {course.title}
                    </h2>
                    <p className="text-[#CFC8A9] text-xs mb-4 flex-grow group-hover:text-[#e7e2c6] transition-colors">
                      {course.description}
                    </p>
                    <div className="flex justify-between items-center text-sm border-t border-[#D4A017]/30 pt-3 mt-auto group-hover:border-[#D4A017] transition-colors">
                      <span className="text-[#D4A017] font-semibold">
                        {course.price}
                      </span>
                      <span className="text-[#CFC8A9] text-xs group-hover:text-white transition-colors">
                        {course.duration}
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