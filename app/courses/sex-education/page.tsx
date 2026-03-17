import Link from 'next/link';
import Image from 'next/image';
import {
  FaArrowRight, FaHeart,
  FaUsers, FaChild,
} from 'react-icons/fa';
import { Inter } from 'next/font/google';
import SexEducationPricing from './_components/SexEducationPricing';
import { SEX_EDUCATION_COURSE } from './config';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

const audience = [
  {
    icon: <FaUsers className="text-3xl text-[#D4A017]" />,
    text: 'Для батьків, у яких ростуть діти та їм не вистачає знань в цій темі',
  },
  {
    icon: <FaChild className="text-3xl text-[#D4A017]" />,
    text: 'Для спеціалістів зі статевого виховання',
  },
  {
    icon: <FaHeart className="text-3xl text-[#D4A017]" />,
    text: 'Для тих, хто служить батькам в темі виховання дітей',
  },
];

const requests = [
  {
    number: '1',
    title: 'Чому важливо говорити?',
    text: 'Відповідає на питання: "Чому так важливо батькам говорити зі своїми дітьми на "ці" теми?"',
  },
  {
    number: '2',
    title: 'Як говорити?',
    text: 'Дає біблійний погляд та вчить, як саме говорити з дітьми та підлітками',
  },
  {
    number: '3',
    title: 'Про що говорити?',
    text: 'Підіймає теми порнографії, кібербезпеки, мастурбації, довіри, відносин, травми тощо',
  },
];

const teachers = [
  { name: 'Марія Клочан', role: 'Викладачка', image: 'Maria-Klochan' },
  { name: 'Марта Холява', role: 'Викладачка', image: 'Marta-Kholyava' },
  { name: 'Світлана Ковальчук', role: 'Викладачка', image: 'Svitlana-Kovalchuk' },
  { name: 'Тетяна Шапошник', role: 'Засновниця UIMP', image: 'Tetiana-Shaposhnik' },
];

const program = [
  {
    title: 'Вступ',
    color: 'from-[#1C3A2E] to-[#2a4f3f]',
    items: [
      'Статеве виховання — тренд чи необхідність? Біблія і статеве виховання',
    ],
  },
  {
    title: 'Основні теми',
    color: 'from-[#D4A017] to-[#b88913]',
    items: [
      'Анатомія і фізіологія',
      'Кордони, дитина-батьки і до чого тут статеве виховання?',
      'Підлітки і розмови з ними про "це"',
      'Дофамін і діти',
      'Важливість особистих відносин батьків з дитиною',
      'Мастурбація',
      'Діти з особливостями розвитку і статеве виховання',
    ],
  },
  {
    title: 'Безпека та виклики',
    color: 'from-[#1C3A2E] to-[#2a4f3f]',
    items: [
      'Фізичне покарання і діти',
      'Аніме та екранний час і до чого тут статеве виховання',
      'Педофіли і діти',
      'Кібербезпека і діти',
      'Дітям про порнографію',
      'Дитина пережила насилля',
    ],
  },
  {
    title: 'Висновок',
    color: 'from-[#D4A017] to-[#b88913]',
    items: [
      'Висновок курсу',
      'Додаткові матеріали',
    ],
  },
];

export default function SexEducationPage() {
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
                {"👨‍👩‍👧 Курс для батьків та педагогів"}
              </div>
              <h1 className="text-5xl md:text-7xl font-bold leading-[1.1]">
                {"Статеве"}
                <br />{"виховання"}
              </h1>
              <p className="text-white/80 text-lg leading-relaxed max-w-xl">
                {'Це курс, який знайомить вас з основними засадами статевого виховання. Дає відповіді на питання: "Як правильно говорити з дітьми?" і "Що Біблія про це каже?"'}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href={SEX_EDUCATION_COURSE.sendpulseUrl}
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
                    src="/courses/sex-education/uimp_wide-logo.webp"
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

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{"Аудиторія"}</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">{"Для кого цей курс?"}</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {audience.map((item, i) => (
            <div key={i} className="bg-[#FDF2EB] p-6 rounded-xl shadow-md hover:shadow-lg transition-all text-center">
              <div className="flex justify-center mb-4">{item.icon}</div>
              <p className="text-gray-700 text-sm">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{"Запити"}</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">{"Який запит закриває курс?"}</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {requests.map((item, i) => (
            <div key={i} className="relative p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-all border border-gray-100">
              <div className="absolute -top-3 -left-3 w-10 h-10 bg-[#D4A017] rounded-full flex items-center justify-center text-white font-bold text-lg">
                {item.number}
              </div>
              <div className="pt-4">
                <h3 className="text-lg font-bold text-[#1C3A2E] mb-3">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{"Команда"}</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">{"Викладачі курсу"}</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {teachers.map((teacher, i) => (
            <div key={i} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all overflow-hidden group">
              <div className="relative h-80 w-full overflow-hidden">
                <Image
                  src={`/courses/sex-education/${teacher.image}.webp`}
                  alt={teacher.name}
                  fill
                  className="object-cover object-top group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <h3 className="text-xl font-bold mb-1">{teacher.name}</h3>
                  <p className="text-white/90 text-sm">{teacher.role}</p>
                </div>
              </div>
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

      <SexEducationPricing />

    </main>
  );
}