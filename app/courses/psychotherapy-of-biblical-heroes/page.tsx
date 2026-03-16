import Link from 'next/link';
import Image from 'next/image';
import {
  FaArrowRight, FaVideo, FaTasks,
  FaBookOpen, FaPray, FaCrown,
} from 'react-icons/fa';
import { Inter } from 'next/font/google';
import BiblicalHeroesPricing from './_components/BiblicalHeroesPricing';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

const about = [
  {
    icon: <FaBookOpen className="text-3xl text-[#D4A017]" />,
    text: 'Духовно-психологічний портрет кожного героя',
  },
  {
    icon: <FaCrown className="text-3xl text-[#D4A017]" />,
    text: 'Авраам, Давид, Ілля, Йосип, Мойсей',
  },
  {
    icon: <FaPray className="text-3xl text-[#D4A017]" />,
    text: 'Уроки для сучасного життя та служіння',
  },
];

const lessons = [
  {
    title: 'Урок 1. Авраам',
    left: [
      'Виклики',
      'Урок здорової сепарації',
      'Урок зрілої вдячності',
    ],
    right: [
      'Урок психологічної гри',
      'Урок жертовності',
      'Урок вивченої безпорадності',
    ],
  },
  {
    title: 'Урок 2. Давид',
    left: [
      'Виклики',
      'Урок терапії емоційно-вразливого типу',
      'Урок терапії формування лідерського впливу',
    ],
    right: [
      'Урок терапії подолання думки оточення (2 частини)',
      "Урок терапії прийняття власної «тіні»",
      'Урок щирості та відкритості',
    ],
  },
  {
    title: 'Урок 3. Ілля',
    left: [
      'Виклики',
      'Урок зцілення депресії',
      'Урок великої тиші',
    ],
    right: [
      'Урок зцілення травми відкинення',
      'Урок зцілення інтроверсії',
      'Урок наставництва',
    ],
  },
  {
    title: 'Урок 4. Йосип',
    left: [
      'Виклики',
      'Огляд нарцисизму як психотипу',
      'Урок терапії зцілення нарцисичності',
    ],
    right: [
      'Урок посттравматичного зростання',
      'Урок близькості',
      'Урок вірності',
    ],
  },
  {
    title: 'Урок 5. Мойсей',
    left: [
      'Виклики',
      'Урок вигорання та кризи ідентичності',
      'Урок подолання соціальної тривоги',
    ],
    right: [
      'Урок емоційної грамотності',
      'Урок вразливості та сили',
      'Урок механізму впливу та важливості зміни поколінь',
    ],
  },
];

export default function BiblicalHeroesPage() {
  return (
    <main className={`min-h-screen bg-white ${inter.className}`}>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] text-white py-16 md:py-20">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-20 w-72 h-72 bg-[#D4A017] rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div className="space-y-6">
              <h1 className="text-4xl md:text-6xl font-bold leading-[1.1]">
                {"Психотерапія"}
                <br />{"біблійних героїв"}
              </h1>
              <p className="text-white/80 text-base leading-relaxed max-w-xl">
                {"Курс для тих, хто хоче отримати свіжий погляд на давно знайомі біблійні історії. Герої Біблії — не ідеальні, а реальні."}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="#price"
                  className="group inline-flex items-center justify-center gap-2 bg-[#D4A017] text-white font-bold px-10 py-4 rounded-lg hover:bg-[#b88913] transition-all duration-300 text-lg"
                >
                  <span>{"ПРИДБАТИ КУРС"}</span>
                  <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="#program"
                  className="inline-flex items-center justify-center px-8 py-4 border border-white/30 rounded-lg hover:bg-white/10 transition-all font-medium"
                >
                  {"ПРОГРАМА"}
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-white/60 text-sm">
                <div className="flex items-center gap-2">
                  <FaVideo className="text-[#D4A017]" />
                  <span>{"5 уроків в записі"}</span>
                </div>
                <span className="w-1 h-1 bg-white/40 rounded-full" />
                <div className="flex items-center gap-2">
                  <FaTasks className="text-[#D4A017]" />
                  <span>{"Додаткові матеріали"}</span>
                </div>
              </div>
            </div>
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
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{"Про курс"}</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">
            {"Новий погляд на знайомі історії"}
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {about.map((item, i) => (
            <div key={i} className="bg-[#FDF2EB] p-6 rounded-xl shadow-md hover:shadow-lg transition-all text-center">
              <div className="flex justify-center mb-4">{item.icon}</div>
              <p className="text-gray-700 text-sm">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Програма */}
      <section id="program" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{"Навчальний план"}</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">{"Програма курсу"}</h2>
          <p className="text-gray-500 text-sm mt-2">{"(усі уроки — в записі)"}</p>
        </div>
        <div className="space-y-8">
          {lessons.map((lesson) => (
            <div key={lesson.title} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
              <div className="bg-gradient-to-r from-[#1C3A2E] to-[#2a4f3f] text-white p-4">
                <h3 className="text-xl font-bold">{lesson.title}</h3>
              </div>
              <div className="p-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="font-semibold text-[#1C3A2E] mb-2">{"Духовно-психологічний портрет"}</p>
                    <ul className="space-y-2 text-gray-600 text-sm">
                      {lesson.left.map((item, j) => (
                        <li key={j} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <ul className="space-y-2 text-gray-600 text-sm">
                      {lesson.right.map((item, j) => (
                        <li key={j} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full mt-1.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Ціна — client boundary ізольовано */}
      <BiblicalHeroesPricing />

    </main>
  );
}