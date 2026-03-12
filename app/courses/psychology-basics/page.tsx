import Link from 'next/link';
import Image from 'next/image';
import { FaTelegram, FaInstagram, FaYoutube, FaArrowRight, FaStar, FaCheck, FaWallet } from 'react-icons/fa';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export default function PsychologyBasicsPage() {
  return (
    <main className={`min-h-screen bg-white ${inter.className}`}>
      {/* Hero Section - преміум */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-white rounded-full mix-blend-multiply filter blur-xl" style={{animation: 'blob 7s infinite'}}></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-[#D4A017] rounded-full mix-blend-multiply filter blur-xl" style={{animation: 'blob 7s infinite', animationDelay: '2s'}}></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="inline-block px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm">
                🔥 Базовий курс UIMP
              </div>
              <h1 className="text-5xl md:text-7xl font-bold leading-[1.1]">
                основи<br />психології
              </h1>
              <p className="text-white/80 text-lg leading-relaxed max-w-xl">
                Це базовий курс, який знайомить вас з методом біблійної терапії, 
                що передбачає зцілення на трьох рівнях: дух, душа та тіло.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="#price"
                  className="group inline-flex items-center gap-2 bg-[#D4A017] text-white font-medium px-8 py-4 rounded-lg hover:bg-[#b88913] transition-all duration-300"
                >
                  Купити курс
                  <FaWallet className="group-hover:scale-110 transition-transform" />
                </Link>
                <Link
                  href="#program"
                  className="inline-flex items-center px-8 py-4 border border-white/30 rounded-lg hover:bg-white/10 transition-all"
                >
                  Програма
                </Link>
              </div>
              
              <div className="flex items-center gap-6 pt-4">
                <div className="flex -space-x-2">
                  {[1,2,3,4].map((i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-[#D4A017] border-2 border-white"></div>
                  ))}
                </div>
                <p className="text-sm text-white/60">
                  <span className="text-white font-bold">200+</span> студентів вже навчаються
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#D4A017] to-[#b88913] rounded-2xl rotate-3 opacity-20"></div>
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

      {/* Що ви отримаєте - преміум картки */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">Переваги</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">
            Що ви отримаєте на курсі?
          </h2>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: '🧠',
              title: 'Базову теоретичну основу',
              text: 'наукової психології з основами християнських цінностей'
            },
            {
              icon: '💫',
              title: 'Глибоке розуміння',
              text: 'як працює дух, душа і тіло'
            },
            {
              icon: '📚',
              title: '15 лекцій в записі',
              text: 'та додаткові матеріали для саморефлексії'
            }
          ].map((item, i) => (
            <div key={i} className="group relative bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-[#1C3A2E]/5 to-transparent rounded-2xl"></div>
              <div className="relative">
                <div className="text-5xl mb-6">{item.icon}</div>
                <h3 className="text-xl font-bold text-[#1C3A2E] mb-3">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Для кого цей курс - з іконками */}
      <section className="bg-[#FDF2EB] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">Аудиторія</span>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">
              Для кого цей курс?
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: '⛪',
                title: 'Служителі',
                text: 'Християнські служителі, які хочуть краще розуміти людину'
              },
              {
                icon: '👥',
                title: 'Психологи',
                text: 'Психологи та консультанти, які прагнуть інтегрувати біблійну основу'
              },
              {
                icon: '💭',
                title: 'Шукаючі',
                text: 'Кожен, хто шукає глибше пізнання себе'
              }
            ].map((item, i) => (
              <div key={i} className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-bold text-[#1C3A2E] mb-3">{item.title}</h3>
                <p className="text-gray-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Який запит закриває - преміум */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              number: '01',
              title: 'Цілісність',
              text: 'Дає цілісне уявлення про особистість людини згідно з біблійною основою'
            },
            {
              number: '02',
              title: 'Відповіді',
              text: 'Відповідає на основні питання про зв\'язок душі, духа та тіла',
              list: ['Як зцілення душі пов\'язане з духом?', 'Яка біблійна роль тіла?']
            },
            {
              number: '03',
              title: 'Інструменти',
              text: 'Навчає бачити коріння проблем глибше та дає інструменти для зцілення'
            }
          ].map((item, i) => (
            <div key={i} className="relative">
              <div className="text-8xl font-black text-[#1C3A2E]/5 absolute -top-6 -left-4">
                {item.number}
              </div>
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

      {/* Викладачі - ВЕЛИКІ ФОТО (повноцінні) */}
      <section className="bg-[#1C3A2E] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">Експерти</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">
              Викладачі курсу
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                name: 'Тетяна Шапошник',
                role: 'Президентка UIMP',
                subtitle: 'психотерапевт, авторка програми',
                image: 'tetiana-shaposhnik',
                stats: '15 років досвіду'
              },
              {
                name: 'Марта Холява',
                role: 'Директорка консультаційного центру',
                subtitle: 'психологиня-консультантка',
                image: 'marta-kholiava',
                stats: '10+ років практики'
              }
            ].map((teacher, i) => (
              <div key={i} className="group relative bg-white rounded-2xl overflow-hidden shadow-2xl hover:shadow-3xl transition-all duration-500">
                <div className="relative h-[500px] w-full overflow-hidden">
                  <Image
                    src={`/courses/psychology-basics/${teacher.image}.webp.webp`}
                    alt={teacher.name}
                    fill
                    className="object-contain object-top group-hover:scale-110 transition-transform duration-700"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                    <div className="inline-block px-3 py-1 bg-[#D4A017] rounded-full text-xs mb-4">
                      {teacher.stats}
                    </div>
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

      {/* Програма курсу - преміум */}
      <section id="program" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">Навчальний план</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">
            Програма курсу
          </h2>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          {[
            {
              title: 'ВСТУП',
              items: ['Історія інтеграції психології і теології', 'Особистість у біблійній терапії'],
              color: 'from-[#1C3A2E] to-[#2a4f3f]'
            },
            {
              title: 'РОЗДІЛ 1: ДУХ',
              items: [
                'Вплив праведності на дух',
                'Вплив проблеми сорому',
                'Вплив почуття провини',
                'Вплив тривоги'
              ],
              color: 'from-[#D4A017] to-[#b88913]'
            },
            {
              title: 'РОЗДІЛ 2: ДУША',
              items: [
                'Важливість душі',
                'Воля як душевний процес',
                'Опори та самооцінка',
                'Душевні фільтри',
                'Емоції Ісуса',
                'Психічні процеси'
              ],
              color: 'from-[#1C3A2E] to-[#2a4f3f]'
            },
            {
              title: 'РОЗДІЛ 3: ТІЛО',
              items: [
                'Важливість тіла. Потреби',
                'Складна психосоматика',
                'Фізіологічні особливості'
              ],
              color: 'from-[#D4A017] to-[#b88913]'
            }
          ].map((section, i) => (
            <div key={i} className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all overflow-hidden">
              <div className={`h-2 bg-gradient-to-r ${section.color}`}></div>
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

      {/* Відгуки - карусель */}
      <section className="bg-[#FDF2EB] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">Відгуки</span>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">
              Що кажуть студенти
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                name: 'Анжела Гумінська',
                text: 'Дякую за курс! Багато корисної інформації. Теми не табуйовані та охоплюють усі сфери життя.',
                image: 'anzhela-huminska',
                rating: 5
              },
              {
                name: 'Олена Курята',
                text: 'Все сподобалось, вдячна за працю. Кожна тема відгукнулась, надихнула на проповідь.',
                image: 'olena-kuriata',
                rating: 5
              },
              {
                name: 'Ніна Приданюк',
                text: 'Рекомендую всім! Якісний ресурс. Зручне навчання для людей з різною зайнятістю.',
                image: 'nina-prydaniuk',
                rating: 5
              },
              {
                name: 'Наталія Зарубіна',
                text: 'Допомогло краще зрозуміти себе. Чекаю наступних курсів!',
                image: 'nataliia-zarubina',
                rating: 5
              }
            ].map((review, i) => (
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
                      {[...Array(review.rating)].map((_, i) => (
                        <FaStar key={i} className="text-[#D4A017] text-xs" />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">
                  "{review.text}"
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ціна + CTA - креативне оформлення */}
      <section id="price" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="relative bg-gradient-to-r from-[#1C3A2E] to-[#2a4f3f] rounded-3xl overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-96 h-96 bg-[#D4A017] rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          </div>
          
          <div className="relative p-12 md:p-16">
            <div className="text-center mb-12">
              <span className="inline-block px-4 py-2 bg-[#D4A017] text-white rounded-full text-sm mb-6">
                🎓 Інвестиція в себе
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Вартість курсу
              </h2>
              <p className="text-white/80 text-lg max-w-2xl mx-auto">
                Оберіть найкращий варіант для свого розвитку
              </p>
            </div>
            
            <div className="max-w-md mx-auto">
              <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 text-center border-2 border-[#D4A017]/30 hover:border-[#D4A017] transition-all">
                <div className="text-sm text-[#D4A017] font-semibold mb-4">Повний доступ</div>
                <div className="flex items-center justify-center gap-2 mb-6">
                  <span className="text-3xl text-white/60 line-through">4900 грн</span>
                  <span className="text-6xl font-black text-white">3500</span>
                  <span className="text-white/60">грн</span>
                </div>
                <div className="space-y-3 mb-8 text-white/80">
                  <p className="flex items-center justify-center gap-2">
                    <FaCheck className="text-[#D4A017]" />
                    Всі 15 лекцій
                  </p>
                  <p className="flex items-center justify-center gap-2">
                    <FaCheck className="text-[#D4A017]" />
                    Доступ 6 місяців
                  </p>
                  <p className="flex items-center justify-center gap-2">
                    <FaCheck className="text-[#D4A017]" />
                    Додаткові матеріали
                  </p>
                </div>
                <Link
                  href="#"
                  className="group inline-flex items-center gap-3 bg-[#D4A017] text-white font-bold py-5 px-12 rounded-xl hover:bg-[#b88913] transition-all text-lg w-full justify-center"
                >
                  <FaWallet className="text-xl" />
                  Купити курс
                </Link>
                <p className="text-white/50 text-sm mt-4">
                  100% гарантія повернення коштів
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Футер */}
      <footer className="bg-white border-t border-gray-100 py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col items-center text-center">
            <p className="text-gray-600 mb-8 max-w-md">
              Залишились запитання? Ми завжди раді допомогти!
            </p>
            
            <a 
              href="mailto:uimp.edu@gmail.com"
              className="text-xl text-[#D4A017] hover:text-[#b88913] transition-colors mb-8"
            >
              uimp.edu@gmail.com
            </a>
            
            <div className="flex flex-wrap justify-center gap-4">
              {[
                { href: 'https://t.me/shaposhnykpsy', icon: FaTelegram, label: 'Telegram' },
                { href: 'https://www.instagram.com/uimp_psychotherapy', icon: FaInstagram, label: 'Instagram' },
                { href: 'https://www.youtube.com/@bible_psychotherapy', icon: FaYoutube, label: 'YouTube' }
              ].map((social, i) => (
                <Link
                  key={i}
                  href={social.href}
                  target="_blank"
                  className="group flex items-center gap-2 px-6 py-3 bg-[#FDF2EB] rounded-full hover:bg-[#D4A017] transition-all duration-300"
                >
                  <social.icon className="text-[#1C3A2E] group-hover:text-white transition-colors" />
                  <span className="text-[#1C3A2E] group-hover:text-white transition-colors">
                    {social.label}
                  </span>
                </Link>
              ))}
            </div>
            
            <div className="mt-12 text-sm text-gray-400">
              © 2024 Ukrainian Institute of Mental Health. Всі права захищені.
            </div>
          </div>
        </div>
      </footer>

      {/* Анімації */}
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