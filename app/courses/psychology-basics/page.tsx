import Link from 'next/link';
import Image from 'next/image';
import { FaCheck, FaStar, FaArrowRight } from 'react-icons/fa';
import { Inter } from 'next/font/google';
import PsychologyPricing from './_components/PsychologyPricing';
import { PSYCHOLOGY_COURSE } from './config';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

const benefits = [
  { icon: '🧠', title: 'Базову теоретичну основу', text: 'наукової психології з основами християнських цінностей' },
  { icon: '💫', title: 'Глибоке розуміння', text: 'як працює дух, душа і тіло' },
  { icon: '📚', title: '15 лекцій в записі', text: 'та додаткові матеріали для саморефлексії' },
];

const audience = [
  { icon: '⛪', title: 'Служителі', text: 'Християнські служителі, які хочуть краще розуміти людину' },
  { icon: '👥', title: 'Психологи', text: 'Психологи та консультанти, які прагнуть інтегрувати біблійну основу' },
  { icon: '💭', title: 'Шукаючі', text: 'Кожен, хто шукає глибше пізнання себе' },
];

const uniqueness = [
  { number: '01', title: 'Цілісність', text: 'Дає цілісне уявлення про особистість людини згідно з біблійною основою' },
  {
    number: '02', title: 'Відповіді',
    text: "Відповідає на основні питання про зв'язок душі, духа та тіла",
    list: ["Як зцілення душі пов'язане з духом?", 'Яка біблійна роль тіла?'],
  },
  { number: '03', title: 'Інструменти', text: 'Навчає бачити коріння проблем глибше та дає інструменти для зцілення' },
];

const teachers = [
  { name: 'Тетяна Шапошник', role: 'Президентка UIMP', subtitle: 'психотерапевт, авторка програми', image: 'tetiana-shaposhnik', stats: '15 років досвіду' },
  { name: 'Марта Холява', role: 'Директорка консультаційного центру', subtitle: 'психологиня-консультантка', image: 'marta-kholiava', stats: '10+ років практики' },
];

const program = [
  {
    title: 'Вступ',
    color: 'from-[#1C3A2E] to-[#2a4f3f]',
    items: [
      'Історія інтеграції',
    ],
  },
  {
    title: 'Дух',
    color: 'from-[#D4A017] to-[#b88913]',
    items: [
      'Особистість у Біблійній терапії',
      'Вплив праведності на дух людини',
      'Вплив проблеми сорому на дух людини',
      'Вплив почуття провини на дух людини',
      'Практичне заняття. Завершуємо тему Духу',
    ],
  },
  {
    title: 'Душа',
    color: 'from-[#1C3A2E] to-[#2a4f3f]',
    items: [
      'Важливість душі',
      'Воля як душевний процес',
      'Внутрішні опори та самооцінка як механізми душі людини',
      'Душевні фільтри сприйняття',
      'Емоції Ісуса',
      'Психічні процеси. Душа та емоції',
    ],
  },
  {
    title: 'Тіло',
    color: 'from-[#D4A017] to-[#b88913]',
    items: [
      'Важливість тіла. Потреби людини',
      'Складна психосоматика',
      'Фізіологічні особивості тіла',
      'Заключення програми',
    ],
  },
];

const reviews = [
  { name: 'Анжела Гумінська', text: 'Дякую за курс! Багато корисної інформації. Теми не табуйовані та охоплюють усі сфери життя.', image: 'anzhela-huminska', rating: 5 },
  { name: 'Олена Курята', text: 'Все сподобалось, вдячна за працю. Кожна тема відгукнулась, надихнула на проповідь.', image: 'olena-kuriata', rating: 5 },
  { name: 'Ніна Приданюк', text: 'Рекомендую всім! Якісний ресурс. Зручне навчання для людей з різною зайнятістю.', image: 'nina-prydaniuk', rating: 5 },
  { name: 'Наталія Зарубіна', text: 'Допомогло краще зрозуміти себе. Чекаю наступних курсів!', image: 'nataliia-zarubina', rating: 5 },
];

export default function PsychologyBasicsPage() {
  return (
    <main className={`min-h-screen bg-white ${inter.className}`}>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-white rounded-full mix-blend-multiply filter blur-xl" style={{ animation: 'blob 7s infinite' }} />
          <div className="absolute top-0 -right-4 w-72 h-72 bg-[#D4A017] rounded-full mix-blend-multiply filter blur-xl" style={{ animation: 'blob 7s infinite', animationDelay: '2s' }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="inline-block px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm">
                {"🔥 Базовий курс UIMP"}
              </div>
              <h1 className="text-5xl md:text-7xl font-bold leading-[1.1]">
                {"Основи"}
                <br />{"психології"}
              </h1>
              <p className="text-white/80 text-lg leading-relaxed max-w-xl">
                {"Це базовий курс, який знайомить вас з методом біблійної терапії, що передбачає зцілення на трьох рівнях: дух, душа та тіло."}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href={PSYCHOLOGY_COURSE.sendpulseUrl}
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
                    src="/courses/psychology-basics/uimp_wide-logo.webp.webp"
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

      {/* Переваги */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{"Переваги"}</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">{"Що ви отримаєте на курсі?"}</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {benefits.map((item, i) => (
            <div key={i} className="group relative bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-[#1C3A2E]/5 to-transparent rounded-2xl" />
              <div className="relative">
                <div className="text-5xl mb-6">{item.icon}</div>
                <h3 className="text-xl font-bold text-[#1C3A2E] mb-3">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Аудиторія */}
      <section className="bg-[#FDF2EB] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{"Аудиторія"}</span>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">{"Для кого цей курс?"}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {audience.map((item, i) => (
              <div key={i} className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-bold text-[#1C3A2E] mb-3">{item.title}</h3>
                <p className="text-gray-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Унікальність */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid md:grid-cols-3 gap-8">
          {uniqueness.map((item, i) => (
            <div key={i} className="relative">
              <div className="text-8xl font-black text-[#1C3A2E]/5 absolute -top-6 -left-4">{item.number}</div>
              <div className="relative pt-12">
                <h3 className="text-2xl font-bold text-[#1C3A2E] mb-4">{item.title}</h3>
                <p className="text-gray-600 mb-4">{item.text}</p>
                {item.list && (
                  <ul className="space-y-2">
                    {item.list.map((li, j) => (
                      <li key={j} className="flex items-start gap-2">
                        <FaCheck className="text-[#D4A017] mt-1 flex-shrink-0" />
                        <span className="text-gray-600 text-sm">{li}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Викладачі */}
      <section className="bg-[#1C3A2E] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{"Експерти"}</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">{"Викладачі курсу"}</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {teachers.map((teacher, i) => (
              <div key={i} className="group relative bg-white rounded-2xl overflow-hidden shadow-2xl hover:shadow-3xl transition-all duration-500">
                <div className="relative h-[500px] w-full overflow-hidden">
                  <Image
                    src={`/courses/psychology-basics/${teacher.image}.webp.webp`}
                    alt={teacher.name}
                    fill
                    className="object-contain object-top group-hover:scale-110 transition-transform duration-700"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                    <div className="inline-block px-3 py-1 bg-[#D4A017] rounded-full text-xs mb-4">{teacher.stats}</div>
                    <h3 className="text-3xl font-bold mb-2">{teacher.name}</h3>
                    <p className="text-white/90 text-lg mb-1">{teacher.role}</p>
                    <p className="text-white/70">{teacher.subtitle}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Програма */}
      <section id="program" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{"Навчальний план"}</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">{"Програма курсу"}</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {program.map((section, i) => (
            <div key={i} className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all overflow-hidden">
              <div className={`h-2 bg-gradient-to-r ${section.color}`} />
              <div className="p-8">
                <h3 className="text-2xl font-bold text-[#1C3A2E] mb-6">{section.title}</h3>
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

      {/* Відгуки */}
      <section className="bg-[#FDF2EB] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{"Відгуки"}</span>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">{"Що кажуть студенти"}</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {reviews.map((review, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl shadow-md hover:shadow-xl transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <Image
                      src={`/courses/psychology-basics/${review.image}.webp.webp`}
                      alt={review.name}
                      fill
                      className="object-cover rounded-full"
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-[#1C3A2E]">{review.name}</p>
                    <div className="flex gap-1">
                      {[...Array(review.rating)].map((_, j) => (
                        <FaStar key={j} className="text-[#D4A017] text-xs" />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">{`"${review.text}"`}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PsychologyPricing />

      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
      `}</style>
    </main>
  );
}