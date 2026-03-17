import Image from 'next/image';
import Link from 'next/link';
import {
  FaArrowRight,
  FaBrain, FaStethoscope, FaPills,
  FaQuoteLeft, FaQuoteRight,
} from 'react-icons/fa';
import { Inter } from 'next/font/google';
import PsychiatryPricing from './_components/PsychiatryPricing';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

const features = [
  {
    icon: <FaBrain className="text-3xl text-[#D4A017]" />,
    text: 'Нейропсихологія та психопатологія',
  },
  {
    icon: <FaStethoscope className="text-3xl text-[#D4A017]" />,
    text: 'Клінічні розлади від депресії до шизофренії',
  },
  {
    icon: <FaPills className="text-3xl text-[#D4A017]" />,
    text: 'Розлади залежностей та сексуальності',
  },
];

const program = [
  {
    title: 'Вступ',
    color: 'from-[#1C3A2E] to-[#2a4f3f]',
    items: [
      "Що таке психічне здоров'я?",
      'Нейропсихологія',
      'Психопатологія',
    ],
  },
  {
    title: 'Психічні розлади',
    color: 'from-[#D4A017] to-[#b88913]',
    items: [
      'Депресія та БАР',
      'Тривожні розлади. Перша частина',
      'Тривожні розлади. Друга частина',
      'Тривожні розлади. Третя частина',
      'Тривожні розлади. Четверта частина: розлади ОКР спектру',
      'Бонусний урок: духовне значення тривоги',
      'Розлади харчової поведінки',
    ],
  },
  {
    title: 'Психотичні розлади',
    color: 'from-[#1C3A2E] to-[#2a4f3f]',
    items: [
      'Дисоціативні розлади чи одержимість',
      'Шизофренія та інші психотичні розлади',
      'Розлади особистості',
      'Розлади сну',
      'Нейрокогнітивні розлади',
    ],
  },
  {
    title: 'Дитяча психіатрія',
    color: 'from-[#D4A017] to-[#b88913]',
    items: [
      'Розлади нейророзвитку. Частина 1: рухові, видільні',
      'Розлади нейророзвитку. Частина 2: інтелектуальні, мовленнєві',
      'Розлади нейророзвитку. Частина 3: РАС та РДУГ',
      'Розлади нейророзвитку. Частина 4: навчання, імпульс контроль',
    ],
  },
  {
    title: 'Розлади сексуальності',
    color: 'from-[#1C3A2E] to-[#2a4f3f]',
    items: ['Розлади сексуальності'],
  },
  {
    title: 'Розлади залежностей',
    color: 'from-[#D4A017] to-[#b88913]',
    items: ['Розлади залежностей'],
  },
];

const SENDPULSE_URL = 'https://uimp-edu.sendpulse.online';

export default function PsychiatryCoursePage() {
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
                {"⚕️ Курс для психологів та душеопікунів"}
              </div>
              <h1 className="text-5xl md:text-7xl font-bold leading-[1.1]">
                {"Основи"}
                <br />{"психіатрії"}
              </h1>
              <p className="text-white/80 text-lg leading-relaxed max-w-xl">
                {"Навчальний курс для психологів, душеопікунів та всіх, кому цікаво знати про психіатрію трохи більше, ніж просто назву"}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href={SENDPULSE_URL}
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
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-12">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{"Авторка курсу"}</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">{"Хто веде курс?"}</h2>
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
                <h3 className="text-xl font-bold text-[#1C3A2E] mb-1">{"Тетяна Шапошник"}</h3>
                <p className="text-[#D4A017] text-sm mb-3">{"Засновниця UIMP, психотерапевтка"}</p>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {"Цю програму я зібрала з моменту моєї студентської клінічної практики у відділі дитячої психоневрології. Свою наукову працю я тоді захистила на відмінно, але мене не полишала думка, що не можна на цьому зупинятися. Так і з'явився цей проєкт."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#FDF2EB] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((item, i) => (
              <div key={i} className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all text-center">
                <div className="flex justify-center mb-4">{item.icon}</div>
                <p className="text-gray-700 text-sm">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="program" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E]">{"Програма курсу"}</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {program.map((section, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all overflow-hidden">
              <div className={`h-2 bg-gradient-to-r ${section.color}`} />
              <div className="p-8">
                <h3 className="text-xl font-bold text-[#1C3A2E] mb-6">{section.title}</h3>
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

      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#FDF2EB] to-[#f5e6d8]" />
        <div className="relative max-w-4xl mx-auto px-4">
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 md:p-12 shadow-2xl border border-white">
            <div className="relative">
              <FaQuoteLeft className="absolute -top-4 -left-2 text-5xl text-[#D4A017] opacity-20" />
              <FaQuoteRight className="absolute -bottom-4 -right-2 text-5xl text-[#D4A017] opacity-20" />
            </div>
            <div className="relative z-10 text-center px-4 md:px-8">
              <p className="text-gray-700 text-base md:text-lg italic leading-relaxed mb-6">
                {"«Це не просто навчальний курс. Це можливість для вашого зростання. Чекаю на ваші відгуки.»"}
              </p>
              <div className="w-24 h-0.5 bg-[#D4A017] mx-auto mb-4" />
              <p className="font-bold text-[#1C3A2E] text-lg">{"Тетяна Шапошник"}</p>
              <p className="text-[#D4A017] text-sm">{"засновниця UIMP"}</p>
            </div>
          </div>
        </div>
      </section>

      <PsychiatryPricing />

    </main>
  );
}