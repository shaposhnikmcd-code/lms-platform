import Link from 'next/link';
import { FaStar, FaShareAlt } from 'react-icons/fa';

// Дані для курсів - змінено ТІЛЬКИ порядок об'єктів
const courses = [
  {
    id: 1,
    title: 'Основи психології',
    description: 'Вступ до психології: базові концепції, теорії та методи',
    price: '2800 грн',
    duration: '2 місяці',
    href: '/courses/psychology-basics'
  },
  {
    id: 2,
    title: 'Курс психологічної підтримки',
    description: 'Базовий курс для психологів та всіх, хто хоче навчитися надавати психологічну підтримку',
    price: '3500 грн',
    duration: '3 місяці',
    href: '/courses/psychological-support'
  },
  {
    id: 3,
    title: 'Основи психіатрії',
    description: 'Вступ до психіатрії для психологів та душеопікунів',
    price: '4100 грн',
    duration: '4 місяці',
    href: '/courses/psychiatry-basics'
  },
  {
    id: 4,
    title: 'Основи душеопікунства',
    description: 'Навчання основам душеопікунства та пастирського консультування',
    price: '3500 грн',
    duration: '3 місяці',
    href: '/courses/mentorship'
  },
  {
  id: 5,
  title: 'Основи християнської психології 2.0',
  description: 'Поглиблений курс з християнської психології для практикуючих психологів',
  price: '4200 грн',
  duration: '4 місяці',
  href: '/courses/Fundamentals-of-Christian-Psychology-2.0'
},
  {
    id: 6,
    title: 'Психотерапія біблійних героїв',
    description: 'Аналіз біблійних персонажів з точки зору психотерапії',
    price: '1400 грн',
    duration: '3 місяці',
    href: '/courses/psychotherapy-of-biblical-heroes'
  }, // ← ТУТ БУЛА ВІДСУТНЯ КОМА!
  {
    id: 7,
    title: 'Статеве виховання',
    description: 'Курс з статевого виховання для психологів та педагогів',
    price: '2900 грн',
    duration: '2 місяці',
    href: '/courses/sex-education'
  },
  {
    id: 8,
    title: 'Курс боротьби з порнозалежністю',
    description: 'Спеціалізований курс з подолання порнозалежності',
    price: '3600 грн',
    duration: '3 місяці',
    href: '/courses/porn-addiction'
  }
];

export default function CoursesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b3d2e] to-[#022d23] p-4">
      <div className="container mx-auto max-w-6xl">
        
        {/* Заголовок з анімацією */}
        <div className="text-center mb-8 animate-fadeIn">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Навчальні курси
          </h1>
          <p className="text-[#e7e2c6]">
            Оберіть курс для професійного та особистісного зростання
          </p>
        </div>

        {/* Сітка курсів з преміум-ефектами */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {courses.map((course, index) => (
            <Link
              key={course.id}
              href={course.href}
              className="bg-[#003d30] rounded-2xl p-5 hover:shadow-xl transition-all duration-300 border border-[#1a5a48] group hover:scale-105 hover:shadow-2xl"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex flex-col h-full">
                {/* Іконка курсу */}
                <div className="mb-3">
                  <span className="text-3xl filter drop-shadow-lg">
                    {course.id === 1 ? '🧠' : 
                     course.id === 2 ? '🤝' : 
                     course.id === 3 ? '⚕️' : 
                     course.id === 4 ? '🫂' : 
                     course.id === 5 ? '✝️' : 
                     course.id === 6 ? '📖' : 
                     course.id === 7 ? '👨‍👩‍👧' : 
                     '💪'}
                  </span>
                </div>

                {/* Заголовок курсу */}
                <h2 className="text-[#e7e2c6] text-lg font-bold mb-2 group-hover:text-white transition-colors">
                  {course.title}
                </h2>
                
                {/* Опис */}
                <p className="text-[#CFC8A9] text-xs mb-4 flex-grow group-hover:text-[#e7e2c6] transition-colors">
                  {course.description}
                </p>
                
                {/* Інформація про курс */}
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

        {/* Додаткова інформація */}
        <div className="mt-8 text-center animate-fadeIn">
          <p className="text-white/40 text-xs">
            Всі курси мають державну сертифікацію
          </p>
        </div>
      </div>
    </div>
  );
}