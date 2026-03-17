import Link from 'next/link';
import Image from 'next/image';
import {
  FaArrowRight,
  FaBookOpen, FaPray, FaCrown,
} from 'react-icons/fa';
import { Inter } from 'next/font/google';
import BiblicalHeroesPricing from './_components/BiblicalHeroesPricing';
import { BIBLICAL_HEROES_COURSE } from './config';

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

const program = [
  {
    title: 'Психотерапія Авраама',
    subtitle: 'Урок зрілого життя в невизначеності',
    color: 'from-[#1C3A2E] to-[#2a4f3f]',
    items: [
      'Духовно-психологічний портрет',
      'Виклики',
      'Урок здорової сепарації',
      'Урок зрілої вдячності',
      'Урок психологічної гри',
      'Урок жертовності',
      'Урок вивченої безпорадності',
    ],
  },
  {
    title: 'Психотерапія Давида',
    subtitle: 'Урок духовно-емоційної зрілості',
    color: 'from-[#D4A017] to-[#b88913]',
    items: [
      'Духовно-психологічний портрет',
      'Виклики',
      'Урок терапії емоційно-вразливого типу',
      'Урок терапії формування лідерського впливу',
      'Урок терапії подолання думки оточення',
      "Урок терапії прийняття власної «тіні»",
      'Урок щирості та відкритості',
    ],
  },
  {
    title: 'Психотерапія Іллі',
    subtitle: 'Урок духовно-психологічної трансформації',
    color: 'from-[#1C3A2E] to-[#2a4f3f]',
    items: [
      'Духовно-психологічний портрет',
      'Виклики',
      'Урок зцілення депресії',
      'Урок великої тиші',
      'Урок зцілення травми відкинення',
      'Урок зцілення інтроверсії',
      'Урок наставництва',
    ],
  },
  {
    title: 'Психотерапія Йосипа',
    subtitle: 'Урок посттравматичного зцілення',
    color: 'from-[#D4A017] to-[#b88913]',
    items: [
      'Духовно-психологічний портрет',
      'Виклики',
      'Огляд нарцисизму як психотипу',
      'Урок терапії зцілення нарцисичності',
      'Урок посттравматичного зростання',
      'Урок близькості',
      'Урок вірності',
    ],
  },
  {
    title: 'Психотерапія Мойсея',
    subtitle: 'Урок мужності',
    color: 'from-[#1C3A2E] to-[#2a4f3f]',
    items: [
      'Духовно-психологічний портрет',
      'Виклики',
      'Урок вигорання та кризи ідентичності',
      'Урок подолання соціальної тривоги',
      'Урок емоційної грамотності',
      'Урок вразливості та сили',
      'Урок механізму впливу та важливості зміни поколінь',
    ],
  },
];

export default function BiblicalHeroesPage() {
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
                {"📖 Курс для психологів та служителів"}
              </div>
              <h1 className="text-5xl md:text-7xl font-bold leading-[1.1]">
                {"Психотерапія біблійних"}
                <br />{"героїв"}
              </h1>
              <p className="text-white/80 text-lg leading-relaxed max-w-xl">
                {"Курс для тих, хто хоче отримати свіжий погляд на давно знайомі біблійні історії. Герої Біблії — не ідеальні, а реальні."}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href={BIBLICAL_HEROES_COURSE.sendpulseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center justify-center gap-2 bg-[#D4A017] text-white font-bold px-10 py-4 rounded-lg hover:bg-[#b88913] transition-all duration-300 text-lg"
                >
                  <span>{"Купити курс"}</span>
                  <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
                </a>
                <Link
                  href="#program"
                  className="inline-flex items-center justify-center px-8 py-4 border border-white/30 rounded-lg hover:bg-white/10 transition-all font-medium"
                >
                  {"Програма"}
                </Link>
              </div>
              <div className="flex items-center gap-6 pt-4">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-[#D4A017] border-2 border-white" />
                  ))}
                </div>
                <p className="text-sm text-white/60">
                  <span className="text-white font-bold">{"200+"}</span>{" студентів вже навчаються"}
                </p>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#D4A017] to-[#b88913] rounded-2xl rotate-3 opacity-20" />
              <div className="relative bg-white/10 backdrop-blur-sm p-8 rounded-2xl border border-white/20">
                <div className="relative h-48">
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
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{"Про курс"}</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">{"Новий погляд на знайомі історії"}</h2>
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

      <section id="program" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{"Навчальний план"}</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">{"Програма курсу"}</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {program.map((section, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all overflow-hidden">
              <div className={`h-2 bg-gradient-to-r ${section.color}`} />
              <div className="p-8">
                <h3 className="text-xl font-bold text-[#1C3A2E] mb-1">{section.title}</h3>
                <p className="text-[#D4A017] text-xs mb-6">{section.subtitle}</p>
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

      <BiblicalHeroesPricing />

    </main>
  );
}