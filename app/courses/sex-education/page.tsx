import Link from 'next/link';
import Image from 'next/image';
import {
  FaArrowRight, FaHeart, FaVideo,
  FaTasks, FaUsers, FaChild,
} from 'react-icons/fa';
import { Inter } from 'next/font/google';
import SexEducationPricing from './_components/SexEducationPricing';

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

const programTopics = [
  'Вступ. Статеве виховання - тренд чи необхідність? Біблія і статеве виховання. (Марія Клочан)',
  'Анатомія і фізіологія. (Світлана Ковальчук)',
  'Кордони, дитина-батьки і до чого тут статеве виховання? (Тетяна Шапошник)',
  'Підлітки і розмови з ними про "це". (Марта Холява)',
  'Дофамін і діти. (Марія Клочан)',
  'Важливість особистих відносин батьків з дитиною. (Марта Холява)',
  'Мастурбація. (Марія Клочан)',
  'Діти з особливостями розвитку і статеве виховання. (Тетяна Шапошник)',
  'Фізичне покарання і діти. (Тетяна Шапошник)',
  'Аніме та екранний час, до чого тут статеве виховання. (Марія Клочан)',
  'Педофіли і діти. (Марія Клочан)',
  'Кібербезпека і діти. (Марія Клочан)',
  'Дітям про порнографію. (Марія Клочан)',
  'Дитина пережила насилля. (Тетяна Шапошник)',
  'Висновок курсу. (Тетяна Шапошник)',
];

export default function SexEducationPage() {
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
                {"Статеве"}
                <br />{"виховання"}
              </h1>
              <p className="text-white/80 text-base leading-relaxed max-w-xl">
                {'Це курс, який знайомить вас з основними засадами статевого виховання. Дає відповіді на питання: "Як правильно говорити з дітьми?" і "Що Біблія про це каже?"'}
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
                  <span>{"15 уроків"}</span>
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
      </section>

      {/* Аудиторія */}
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

      {/* Запити */}
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

      {/* Викладачі */}
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

      {/* Програма */}
      <section id="program" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{"Навчальний план"}</span>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">{"Програма курсу"}</h2>
        </div>
        <div className="space-y-3">
          {programTopics.map((topic, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-[#FDF2EB] transition-all group">
              <div className="w-6 h-6 bg-[#D4A017] rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 group-hover:scale-105 transition-transform">
                {i + 1}
              </div>
              <p className="text-gray-700 text-sm">{topic}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Ціна — client boundary ізольовано */}
      <SexEducationPricing />

    </main>
  );
}