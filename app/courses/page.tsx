import Link from 'next/link';
import { FaStar, FaShareAlt } from 'react-icons/fa';

// Дані для курсів
const courses = [
  {
    id: 1,
    title: 'Курс психологічної підтримки',
    description: 'Базовий курс для психологів та всіх, хто хоче навчитися надавати психологічну підтримку',
    price: '3500 грн',
    duration: '3 місяці',
    href: '/courses/psychological-support'
  },
  {
    id: 2,
    title: 'Основи християнської психології 2.0',
    description: 'Поглиблений курс з християнської психології для практикуючих психологів',
    price: '4200 грн',
    duration: '4 місяці',
    href: '/courses/christian-psychology'
  },
  {
    id: 3,
    title: 'Основи психології',
    description: 'Вступ до психології: базові концепції, теорії та методи',
    price: '2800 грн',
    duration: '2 місяці',
    href: '/courses/psychology-basics'  // Це посилання тепер активне!
  },
  {
    id: 4,
    title: 'Основи душеопікунства',
    description: 'Навчання основам душеопікунства та пастирського консультування',
    price: '3200 грн',
    duration: '3 місяці',
    href: '/courses/counseling-basics'
  },
  {
    id: 5,
    title: 'Психотерапія біблійних героїв',
    description: 'Аналіз біблійних персонажів з точки зору психотерапії',
    price: '3800 грн',
    duration: '3 місяці',
    href: '/courses/biblical-heroes'
  },
  {
    id: 6,
    title: 'Статеве виховання',
    description: 'Курс з статевого виховання для психологів та педагогів',
    price: '2900 грн',
    duration: '2 місяці',
    href: '/courses/sex-education'
  },
  {
    id: 7,
    title: 'Основи психіатрії',
    description: 'Вступ до психіатрії для психологів та душеопікунів',
    price: '4100 грн',
    duration: '4 місяці',
    href: '/courses/psychiatry-basics'
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
        
        {/* Заголовок */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Навчальні курси
          </h1>
          <p className="text-[#e7e2c6]">
            Оберіть курс для професійного та особистісного зростання
          </p>
        </div>

        {/* Сітка курсів */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={course.href}
              className="bg-[#003d30] rounded-2xl p-5 hover:shadow-xl transition-all border border-[#1a5a48] group"
            >
              <div className="flex flex-col h-full">
                {/* Заголовок курсу */}
                <h2 className="text-[#e7e2c6] text-lg font-bold mb-2 group-hover:text-white transition-colors">
                  {course.title}
                </h2>
                
                {/* Опис */}
                <p className="text-[#CFC8A9] text-xs mb-4 flex-grow">
                  {course.description}
                </p>
                
                {/* Інформація про курс */}
                <div className="flex justify-between items-center text-sm border-t border-[#1a5a48] pt-3 mt-auto">
                  <span className="text-[#e7e2c6] font-semibold">
                    {course.price}
                  </span>
                  <span className="text-[#CFC8A9] text-xs">
                    {course.duration}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Додаткова інформація */}
        <div className="mt-8 text-center">
          <p className="text-white/40 text-xs">
            Всі курси мають державну сертифікацію
          </p>
        </div>
      </div>
    </div>
  );
}