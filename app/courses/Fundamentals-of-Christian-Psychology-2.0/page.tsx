// app/courses/Fundamentals-of-Christian-Psychology-2.0/page.tsx
import Link from 'next/link';
import Image from 'next/image';
import { FaTelegram, FaInstagram, FaYoutube, FaArrowRight, FaHeart, FaVideo, FaUsers, FaClock, FaPray, FaBrain, FaCalendarAlt, FaQuoteLeft, FaQuoteRight } from 'react-icons/fa';
import { Inter } from 'next/font/google';
import WayForPayButton from '@/components/WayForPayButton';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export default function ChristianPsychologyPage() {
  return (
    <main className={`min-h-screen bg-white ${inter.className}`}>
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] text-white py-16 md:py-20">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-20 w-72 h-72 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-20 w-72 h-72 bg-[#D4A017] rounded-full blur-3xl"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div className="space-y-6">
              <div className="inline-block px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm border border-white/20">
                🔥 Інтенсивний курс
              </div>
              <h1 className="text-4xl md:text-6xl font-bold leading-[1.1]">
                Основи<br />християнської<br />психології 2.0
              </h1>
              <p className="text-white/80 text-base leading-relaxed max-w-xl">
                Онлайн-курс Тетяни Шапошнік. Ми не просто будемо вивчати психологію — 
                ми розглянемо людину на основі біблійної структури: духа, душі і тіла.
              </p>
              
              {/* Кнопки */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="#price"
                  className="group inline-flex items-center justify-center gap-2 bg-[#D4A017] text-white font-bold px-10 py-4 rounded-lg hover:bg-[#b88913] transition-all duration-300 text-lg"
                >
                  <span>ОБРАТИ ТАРИФ</span>
                  <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="#program"
                  className="inline-flex items-center justify-center px-8 py-4 border border-white/30 rounded-lg hover:bg-white/10 transition-all font-medium"
                >
                  ПРОГРАМА
                </Link>
              </div>

              {/* Характеристики */}
              <div className="flex flex-wrap items-center gap-4 text-white/60 text-sm">
                <div className="flex items-center gap-2">
                  <FaClock className="text-[#D4A017]" />
                  <span>3 тижні</span>
                </div>
                <span className="w-1 h-1 bg-white/40 rounded-full"></span>
                <div className="flex items-center gap-2">
                  <FaVideo className="text-[#D4A017]" />
                  <span>Лекції в записі</span>
                </div>
                <span className="w-1 h-1 bg-white/40 rounded-full"></span>
                <div className="flex items-center gap-2">
                  <FaUsers className="text-[#D4A017]" />
                  <span>Практичні заняття</span>
                </div>
              </div>
            </div>
            
            {/* Блок з логотипом */}
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-3xl border border-white/20">
              <div className="relative h-40 w-full">
                <Image
                  src="/courses/Fundamentals-of-Christian-Psychology-2.0/uimp_wide-logo.webp"
                  alt="UIMP Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Авторка курсу */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">Авторка</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">
            Хто веде курс?
          </h2>
        </div>
        
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="md:flex">
              <div className="md:w-1/3 relative h-64 md:h-auto">
                <Image
                  src="/courses/Fundamentals-of-Christian-Psychology-2.0/tetiana-shaposhnik.webp"
                  alt="Тетяна Шапошник"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6 md:w-2/3">
                <h3 className="text-xl font-bold text-[#1C3A2E] mb-1">Тетяна Шапошник</h3>
                <p className="text-[#D4A017] text-sm mb-3">Засновниця UIMP, психотерапевтка</p>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Авторка курсу з багаторічним досвідом у сфері християнської психології та душеопікунства.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Що обговоримо */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">Теми</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">
            Що ми обговоримо?
          </h2>
          <p className="text-gray-500 text-sm mt-2">Протягом 3 тижнів активної роботи</p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: <FaPray className="text-2xl text-[#D4A017]" />,
              title: 'Різновиди проблем',
              text: 'Чим відрізняються духовні проблеми від душевних?'
            },
            {
              icon: <FaHeart className="text-2xl text-[#D4A017]" />,
              title: 'Робота з проблемами',
              text: 'Як побороти тривогу, сором та провину?'
            },
            {
              icon: <FaBrain className="text-2xl text-[#D4A017]" />,
              title: 'Робота з емоціями',
              text: 'Як проявляти емоції, щоб не грішити?'
            },
            {
              icon: <FaUsers className="text-2xl text-[#D4A017]" />,
              title: 'Робота з тілом',
              text: 'Чому питання тіла теж важливі?'
            }
          ].map((item, i) => (
            <div key={i} className="bg-[#FDF2EB] p-5 rounded-xl shadow-md hover:shadow-lg transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white rounded-lg">{item.icon}</div>
                <h3 className="font-bold text-[#1C3A2E]">{item.title}</h3>
              </div>
              <p className="text-gray-600 text-sm">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Що будемо робити */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-r from-[#1C3A2E] to-[#2a4f3f] rounded-2xl p-8 md:p-10 text-white">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <h2 className="text-2xl md:text-3xl font-bold">Що будемо робити?</h2>
              <p className="text-white/80 text-sm leading-relaxed">
                Ми познайомимося в групі на практичних заняттях, будемо робити вправи, 
                які ви зможете застосовувати у вашому служінні чи для особистої допомоги.
              </p>
              <p className="text-white/80 text-sm leading-relaxed">
                Ви будете перебувати у теплій підтримці один одного, де ми будемо вчитися 
                підтримувати та довіряти.
              </p>
              <p className="text-white font-medium text-sm mt-4">
                Цей досвід навчання ви точно запам'ятаєте на все життя!
              </p>
            </div>
            <div className="flex justify-center">
              <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl border border-white/20">
                <FaUsers className="text-6xl text-[#D4A017] mx-auto" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Програма курсу з датами */}
      <section id="program" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">Розклад</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">
            Програма курсу
          </h2>
        </div>

        <div className="space-y-8">
          {/* Тема Духа */}
          <div>
            <h3 className="text-xl font-bold text-[#1C3A2E] mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-[#D4A017] rounded-full"></span>
              Тема Духа
            </h3>
            <div className="space-y-2">
              {[
                { date: '4 Березня', title: 'Чому психологія є саме християнською в своїй першородній основі? Історія психології в розрізі християнства' },
                { date: '5 Березня', title: 'Божі облаштунки та важливість духовної частини особистості' },
                { date: '6 Березня', title: 'Яку шкоду несе сором' },
                { date: '7 Березня', title: 'Що робити з почуттям провини' },
                { date: '8 Березня', title: 'Тривога та боротьба з нею' }
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-[#FDF2EB] transition-all">
                  <div className="min-w-[90px] text-[#D4A017] font-medium text-sm flex items-center gap-1">
                    <FaCalendarAlt className="text-xs" />
                    {item.date}
                  </div>
                  <p className="text-gray-700 text-sm">{item.title}</p>
                </div>
              ))}
              <div className="mt-2 p-3 bg-[#D4A017]/10 rounded-lg border border-[#D4A017]/20">
                <p className="text-[#1C3A2E] font-medium text-sm flex items-center gap-2">
                  <FaUsers className="text-[#D4A017]" />
                  <span>Практичне заняття в прямому етері: 9 Березня, 15:00-17:00 (за київським часом)</span>
                </p>
              </div>
            </div>
          </div>

          {/* Тема Душі */}
          <div>
            <h3 className="text-xl font-bold text-[#1C3A2E] mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-[#D4A017] rounded-full"></span>
              Тема Душі
            </h3>
            <div className="space-y-2">
              {[
                { date: '11 Березня', title: 'Важливість душі' },
                { date: '12 Березня', title: 'Воля як душевний процес' },
                { date: '13 Березня', title: 'Внутрішні опори та самооцінка' },
                { date: '14 Березня', title: 'Когнітивні викривлення' },
                { date: '15 Березня', title: 'Психічні процеси та емоції' },
                { date: '16 Березня', title: 'Емоції Ісуса' }
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-[#FDF2EB] transition-all">
                  <div className="min-w-[90px] text-[#D4A017] font-medium text-sm flex items-center gap-1">
                    <FaCalendarAlt className="text-xs" />
                    {item.date}
                  </div>
                  <p className="text-gray-700 text-sm">{item.title}</p>
                </div>
              ))}
              <div className="mt-2 p-3 bg-[#D4A017]/10 rounded-lg border border-[#D4A017]/20">
                <p className="text-[#1C3A2E] font-medium text-sm flex items-center gap-2">
                  <FaUsers className="text-[#D4A017]" />
                  <span>Практичне заняття в прямому етері: 17 Березня, 15:00-17:00 (за київським часом)</span>
                </p>
              </div>
            </div>
          </div>

          {/* Тема Тіла */}
          <div>
            <h3 className="text-xl font-bold text-[#1C3A2E] mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-[#D4A017] rounded-full"></span>
              Тема Тіла
            </h3>
            <div className="space-y-2">
              {[
                { date: '18 Березня', title: 'Важливість тіла та його здоров\'я' },
                { date: '19 Березня', title: 'Складна психосоматика' },
                { date: '20 Березня', title: 'Базові потреби' },
                { date: '21 Березня', title: 'Складнощі тілесних дисфункцій' }
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-[#FDF2EB] transition-all">
                  <div className="min-w-[90px] text-[#D4A017] font-medium text-sm flex items-center gap-1">
                    <FaCalendarAlt className="text-xs" />
                    {item.date}
                  </div>
                  <p className="text-gray-700 text-sm">{item.title}</p>
                </div>
              ))}
              <div className="mt-2 p-3 bg-[#D4A017]/10 rounded-lg border border-[#D4A017]/20">
                <p className="text-[#1C3A2E] font-medium text-sm flex items-center gap-2">
                  <FaUsers className="text-[#D4A017]" />
                  <span>Практичне заняття в прямому етері: 22 Березня, 19:00-21:00 (за київським часом)</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Тарифи */}
      <section id="price" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">Вартість</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">
            Оберіть свій тариф
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Для нових учасників */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-[#D4A017]">
            <div className="bg-[#D4A017] text-white p-4 text-center">
              <h3 className="text-xl font-bold">Для нових учасників</h3>
            </div>
            <div className="p-6">
              <div className="text-3xl font-black text-[#1C3A2E] mb-2">4200 грн</div>
              <p className="text-gray-500 text-sm mb-4">Доступ до лекцій для тих, хто приєднується вперше</p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full"></span>
                  Всі лекції в записі
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full"></span>
                  Практичні заняття
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full"></span>
                  Лист з доступом на email
                </li>
              </ul>
              <WayForPayButton
  courseName="Основи християнської психології 2.0 - Новий учасник"
  price={4200}
  courseId="christian-psychology-new"
/>
            </div>
          </div>

          {/* Для учасників інших курсів */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
            <div className="bg-[#1C3A2E] text-white p-4 text-center">
              <h3 className="text-xl font-bold">Для учасників інших курсів</h3>
            </div>
            <div className="p-6">
              <div className="text-3xl font-black text-[#1C3A2E] mb-2">3700 грн</div>
              <p className="text-gray-500 text-sm mb-4">Для тих, хто проходив будь-який наш курс раніше</p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full"></span>
                  Всі лекції в записі
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full"></span>
                  Практичні заняття
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full"></span>
                  Лист з доступом на email
                </li>
              </ul>
              <WayForPayButton
  courseName="Основи християнської психології 2.0 - Учасник курсів"
  price={3700}
  courseId="christian-psychology-alumni"
/>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-r from-[#1C3A2E] to-[#2a4f3f] rounded-2xl p-8 md:p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Долучайся до програми вже сьогодні
          </h2>
          <p className="text-white/80 text-sm mb-6 max-w-xl mx-auto">
            3 тижні інтенсивної роботи, лекції в записі та практичні заняття
          </p>
          <Link
            href="#price"
            className="inline-block bg-[#D4A017] text-white font-bold py-3 px-8 rounded-lg hover:bg-[#b88913] transition-all"
          >
            Приєднатися
          </Link>
        </div>
      </section>

      {/* Футер */}
      <footer className="bg-white border-t border-gray-100 py-10">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-600 text-sm mb-4">
            Залишились запитання? Напишіть нам!
          </p>
          
          <a 
            href="mailto:uimp.edu@gmail.com" 
            className="text-base text-[#D4A017] hover:text-[#b88913] transition-colors mb-4 inline-block"
          >
            uimp.edu@gmail.com
          </a>
          
          <div className="flex justify-center gap-3 mb-6">
            <Link href="https://t.me/shaposhnykpsy" target="_blank" className="bg-[#FDF2EB] p-2.5 rounded-full hover:bg-[#D4A017] group transition-colors">
              <FaTelegram className="text-[#1C3A2E] text-sm group-hover:text-white" />
            </Link>
            <Link href="https://www.instagram.com/uimp_psychotherapy" target="_blank" className="bg-[#FDF2EB] p-2.5 rounded-full hover:bg-[#D4A017] group transition-colors">
              <FaInstagram className="text-[#1C3A2E] text-sm group-hover:text-white" />
            </Link>
            <Link href="https://www.youtube.com/@bible_psychotherapy" target="_blank" className="bg-[#FDF2EB] p-2.5 rounded-full hover:bg-[#D4A017] group transition-colors">
              <FaYoutube className="text-[#1C3A2E] text-sm group-hover:text-white" />
            </Link>
          </div>
          
          <p className="text-gray-400 text-xs">
            © 2025 Ukrainian Institute of Mental Health
          </p>
        </div>
      </footer>
    </main>
  );
}