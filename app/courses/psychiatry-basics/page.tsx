// app/courses/psychiatry-basics/page.tsx
import Link from 'next/link';
import Image from 'next/image';
import { FaTelegram, FaInstagram, FaYoutube, FaArrowRight, FaHeart, FaVideo, FaTasks, FaBrain, FaStethoscope, FaPills, FaQuoteLeft, FaQuoteRight } from 'react-icons/fa';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export default function PsychiatryCoursePage() {
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
              <h1 className="text-4xl md:text-6xl font-bold leading-[1.1]">
                Основи<br />психіатрії
              </h1>
              <p className="text-white/80 text-base leading-relaxed max-w-xl">
                Навчальний курс для психологів, душеопікунів та всіх, кому цікаво знати про психіатрію трохи більше, ніж просто назву
              </p>
              
              {/* Кнопки */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="#price"
                  className="group inline-flex items-center justify-center gap-2 bg-[#D4A017] text-white font-bold px-10 py-4 rounded-lg hover:bg-[#b88913] transition-all duration-300 text-lg"
                >
                  <span>ПРИДБАТИ КУРС</span>
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
                  <FaVideo className="text-[#D4A017]" />
                  <span>31 година відео</span>
                </div>
                <span className="w-1 h-1 bg-white/40 rounded-full"></span>
                <div className="flex items-center gap-2">
                  <FaTasks className="text-[#D4A017]" />
                  <span>Бонусні уроки</span>
                </div>
              </div>
            </div>
            
            {/* Блок з логотипом UIMP */}
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-3xl border border-white/20">
              <div className="relative h-40 w-full">
                <Image
                  src="/courses/psychiatry-basics/uimp_wide-logo.webp"
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

      {/* Авторка курсу - з фото tetiana-shaposhnik */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">Авторка курсу</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">
            Хто веде курс?
          </h2>
        </div>
        
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="md:flex">
              <div className="md:w-1/3 relative h-56 md:h-auto">
                <Image
                  src="/courses/psychiatry-basics/tetiana-shaposhnik.webp"
                  alt="Тетяна Шапошник"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6 md:w-2/3">
                <h3 className="text-xl font-bold text-[#1C3A2E] mb-1">Тетяна Шапошник</h3>
                <p className="text-[#D4A017] text-sm mb-3">Засновниця UIMP, психотерапевтка</p>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Цю програму я зібрала з моменту моєї студентської клінічної практики у відділі дитячої психоневрології. Свою наукову працю я тоді захистила на відмінно, але мене не полишала думка, що не можна на цьому зупинятися. Так і з'явився цей проєкт.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Решта секцій без змін... */}
      {/* Особливості курсу */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: <FaBrain className="text-3xl text-[#D4A017]" />,
              text: 'Нейропсихологія та психопатологія'
            },
            {
              icon: <FaStethoscope className="text-3xl text-[#D4A017]" />,
              text: 'Клінічні розлади від депресії до шизофренії'
            },
            {
              icon: <FaPills className="text-3xl text-[#D4A017]" />,
              text: 'Розлади залежностей та сексуальності'
            }
          ].map((item, i) => (
            <div key={i} className="bg-[#FDF2EB] p-6 rounded-xl shadow-md hover:shadow-lg transition-all text-center">
              <div className="flex justify-center mb-4">{item.icon}</div>
              <p className="text-gray-700 text-sm">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Програма курсу */}
      <section id="program" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">Навчальний план</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">
            Програма курсу
          </h2>
        </div>
        
        <div className="space-y-3">
          {[
            'Вступ. Що таке психічне здоров’я',
            'Нейропсихологія',
            'Психопатологія',
            'Депресія та БАР',
            'Розлади тривоги. Частина 1: Визначення тривоги, ГТР',
            'Тривожні розлади. Частина 2: Панічний розлад, агорафобія, тривога за здоров\'я',
            'Тривожні розлади. Частина 3: Соматоморфні, соціальні та материнські розлади',
            'Тривожні розлади. Частина 4: Обсесивно-компульсивний спектр',
            'Бонус: духовне значення тривоги',
            'Розлади харчової поведінки',
            'Дисоціативні розлади чи одержимість',
            'Шизофренія та інші психотичні розлади',
            'Розлади особистості',
            'Розлади сну',
            'Нейрокогнітивні розлади',
            'Розлади нейророзвитку. Частина 1: рухові, видільні',
            'Розлади нейророзвитку. Частина 2: інтелектуальні, мовленнєві',
            'Розлади нейророзвитку. Частина 3: РАС та РДУГ',
            'Розлади нейророзвитку. Частина 4: навчання, імпульс контроль',
            'Розлади сексуальності',
            'Розлади залежностей'
          ].map((topic, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-[#FDF2EB] transition-all group">
              <div className="w-6 h-6 bg-[#D4A017] rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 group-hover:scale-105 transition-transform">
                {i + 1}
              </div>
              <p className="text-gray-700 text-sm">{topic}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Цитата від Тетяни */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#FDF2EB] to-[#f5e6d8]"></div>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 right-10 w-64 h-64 bg-[#D4A017] rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative max-w-4xl mx-auto px-4">
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 md:p-12 shadow-2xl border border-white">
            
            <div className="relative">
              <FaQuoteLeft className="absolute -top-4 -left-2 text-5xl text-[#D4A017] opacity-20" />
              <FaQuoteRight className="absolute -bottom-4 -right-2 text-5xl text-[#D4A017] opacity-20" />
            </div>
            
            <div className="relative z-10 text-center px-4 md:px-8">
              <p className="text-gray-700 text-base md:text-lg italic leading-relaxed mb-6">
                "Це не просто навчальний курс. Це можливість для вашого зростання. Чекаю на ваші відгуки."
              </p>
              
              <div className="w-24 h-0.5 bg-[#D4A017] mx-auto mb-4"></div>
              
              <div>
                <p className="font-bold text-[#1C3A2E] text-lg">Тетяна Шапошник</p>
                <p className="text-[#D4A017] text-sm">засновниця UIMP</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ціна та CTA */}
      <section id="price" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-r from-[#1C3A2E] to-[#2a4f3f] rounded-2xl p-8 md:p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Розпочніть навчання прямо зараз!
          </h2>
          <p className="text-white/80 text-sm mb-6 max-w-xl mx-auto">
            31 година відео, бонусні уроки та додаткові матеріали
          </p>
          <div className="max-w-sm mx-auto bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <div className="text-3xl font-black text-white mb-3">4100 грн</div>
            <p className="text-white/60 text-xs mb-4">Повний доступ на 6 місяців</p>
            <Link
              href="#"
              className="inline-block w-full bg-[#D4A017] text-white font-bold py-3 px-6 rounded-lg hover:bg-[#b88913] transition-all"
            >
              Придбати курс
            </Link>
          </div>
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