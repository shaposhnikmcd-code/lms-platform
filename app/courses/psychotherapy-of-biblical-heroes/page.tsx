// app/courses/psychotherapy-of-biblical-heroes/page.tsx
import Link from 'next/link';
import Image from 'next/image';
import { FaTelegram, FaInstagram, FaYoutube, FaArrowRight, FaHeart, FaVideo, FaTasks, FaBookOpen, FaPray, FaCrown, FaQuoteLeft, FaQuoteRight } from 'react-icons/fa';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export default function BiblicalHeroesPage() {
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
                Психотерапія<br />біблійних героїв
              </h1>
              <p className="text-white/80 text-base leading-relaxed max-w-xl">
                Курс для тих, хто хоче отримати свіжий погляд на давно знайомі біблійні історії. Герої Біблії — не ідеальні, а реальні.
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
                  <span>5 уроків в записі</span>
                </div>
                <span className="w-1 h-1 bg-white/40 rounded-full"></span>
                <div className="flex items-center gap-2">
                  <FaTasks className="text-[#D4A017]" />
                  <span>Додаткові матеріали</span>
                </div>
              </div>
            </div>
            
            {/* Блок з логотипом */}
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-3xl border border-white/20">
              <div className="relative h-40 w-full">
                <Image
                  src="/courses/psychotherapy-of-biblical-heroes/uimp_wide-logo-bible.webp"
                  alt="Психотерапія біблійних героїв"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Про курс */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">Про курс</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">
            Новий погляд на знайомі історії
          </h2>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: <FaBookOpen className="text-3xl text-[#D4A017]" />,
              text: 'Духовно-психологічний портрет кожного героя'
            },
            {
              icon: <FaCrown className="text-3xl text-[#D4A017]" />,
              text: 'Авраам, Давид, Ілля, Йосип, Мойсей'
            },
            {
              icon: <FaPray className="text-3xl text-[#D4A017]" />,
              text: 'Уроки для сучасного життя та служіння'
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
          <p className="text-gray-500 text-sm mt-2">(усі уроки — в записі)</p>
        </div>
        
        <div className="space-y-8">
          {/* Урок 1. Авраам */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
            <div className="bg-gradient-to-r from-[#1C3A2E] to-[#2a4f3f] text-white p-4">
              <h3 className="text-xl font-bold">Урок 1. Авраам</h3>
            </div>
            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-[#1C3A2E] mb-2">Духовно-психологічний портрет</p>
                  <ul className="space-y-2 text-gray-600 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Виклики</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Урок здорової сепарації</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Урок зрілої вдячності</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <ul className="space-y-2 text-gray-600 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Урок психологічної гри</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Урок жертовності</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Урок вивченої безпорадності</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Урок 2. Давид */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
            <div className="bg-gradient-to-r from-[#1C3A2E] to-[#2a4f3f] text-white p-4">
              <h3 className="text-xl font-bold">Урок 2. Давид</h3>
            </div>
            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-[#1C3A2E] mb-2">Духовно-психологічний портрет</p>
                  <ul className="space-y-2 text-gray-600 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Виклики</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Урок терапії емоційно-вразливого типу</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Урок терапії формування лідерського впливу</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <ul className="space-y-2 text-gray-600 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Урок терапії подолання думки оточення (2 частини)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Урок терапії прийняття власної "тіні"</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Урок щирості та відкритості</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Урок 3. Ілля */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
            <div className="bg-gradient-to-r from-[#1C3A2E] to-[#2a4f3f] text-white p-4">
              <h3 className="text-xl font-bold">Урок 3. Ілля</h3>
            </div>
            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-[#1C3A2E] mb-2">Духовно-психологічний портрет</p>
                  <ul className="space-y-2 text-gray-600 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Виклики</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Урок зцілення депресії</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Урок великої тиші</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <ul className="space-y-2 text-gray-600 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Урок зцілення травми відкинення</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Урок зцілення інтроверсії</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Урок наставництва</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Урок 4. Йосип */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
            <div className="bg-gradient-to-r from-[#1C3A2E] to-[#2a4f3f] text-white p-4">
              <h3 className="text-xl font-bold">Урок 4. Йосип</h3>
            </div>
            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-[#1C3A2E] mb-2">Духовно-психологічний портрет</p>
                  <ul className="space-y-2 text-gray-600 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Виклики</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Огляд нарцисизму як психотипу</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Урок терапії зцілення нарцисичності</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <ul className="space-y-2 text-gray-600 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Урок посттравматичного зростання</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Урок близькості</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Урок вірності</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Урок 5. Мойсей */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
            <div className="bg-gradient-to-r from-[#1C3A2E] to-[#2a4f3f] text-white p-4">
              <h3 className="text-xl font-bold">Урок 5. Мойсей</h3>
            </div>
            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-[#1C3A2E] mb-2">Духовно-психологічний портрет</p>
                  <ul className="space-y-2 text-gray-600 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Виклики</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Урок вигорання та кризи ідентичності</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Урок подолання соціальної тривоги</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <ul className="space-y-2 text-gray-600 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Урок емоційної грамотності</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Урок вразливості та сили</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5"></span>
                      <span>Урок механізму впливу та важливості зміни поколінь</span>
                    </li>
                  </ul>
                </div>
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
            5 уроків в записі, доступ до всіх матеріалів
          </p>
          <div className="max-w-sm mx-auto bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <div className="text-3xl font-black text-white mb-3">1400 грн</div>
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
            Залишились запитання? Зверніться в підтримку — радо надамо відповіді!
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