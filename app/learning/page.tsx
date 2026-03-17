import Link from 'next/link';
import Image from 'next/image';
import {
  FaGraduationCap, FaCheckCircle, FaArrowRight,
  FaStar, FaQuoteLeft, FaChevronRight,
} from 'react-icons/fa';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

const SENDPULSE_URL = 'https://uimp-edu.sendpulse.online/bible-therapy';

const stats = [
  { value: '9', label: 'навчальних модулів' },
  { value: '100+', label: 'уроків в записі' },
  { value: '9', label: 'зустрічей з кураторами' },
  { value: '200+', label: 'студентів навчались' },
];

const modules = [
  {
    number: '01',
    title: 'Історія розвитку психотерапії та душеопіки',
    color: 'from-[#1C3A2E] to-[#2a4f3f]',
    items: [
      'Знайомство',
      'Античний період розвитку історії психології',
      'Середньовічний період',
      'Психологія періоду епохи Відродження',
      'Психологія Євангельського періоду',
      'Розвиток психології як науки',
      'Психологія і теологія. Дослідження спільних концепцій',
      'Здорові та нездорові точки перетину психології та теології',
      'Сучасні методи душеопіки та психотерапії. Психоаналіз',
      'Гуманістичний напрямок',
      'КПТ напрям',
    ],
  },
  {
    number: '02',
    title: 'Збір анамнезу, обстеження і перше консультування у методі біблійної терапії',
    color: 'from-[#D4A017] to-[#b88913]',
    items: [
      'Важливість психологічної допомоги християнам',
      'Метод біблійної терапії',
      'Організація консультування',
      'Діагностика тілесного стану',
      'Принципи базових потреб',
      'Базові потреби: сон, їжа, відпочинок',
      'Діагностика душевних структур',
      'Цінності',
      'Емоції',
      'Діагностика духовної структури. Пояс істини',
      'Броня праведності та ідентичність',
      'Інші Божі обладунки',
      'Контракт на терапію',
    ],
  },
  {
    number: '03',
    title: 'Застосування інструментів напрямків сучасної психотерапії в біблійній терапії. Частина 1',
    color: 'from-[#1C3A2E] to-[#2a4f3f]',
    items: [
      'Організація побудування терапевтичної роботи',
      'Причини ментальних проблем',
      'Визначення депресії',
      'Критерії та типи депресії',
      'Терапія депресії',
      'Інструменти опрацювання проблем душі',
      "Робота зі «злиттям» думок",
      'Ідентичність при депресії',
      'Тривога — подарунок від Бога',
      'Слабка і сильна сторона тривоги',
      'Тривожно-депресивний розлад',
    ],
  },
  {
    number: '04',
    title: 'Застосування основних інструментів сучасної психотерапії в запитах біблійної терапії. Частина 2',
    color: 'from-[#D4A017] to-[#b88913]',
    items: [
      'Що таке залежність і її духовні закони',
      'Причини виникнення залежності',
      'Формування залежності через розвиток дитячого стану',
      'Історія залежності Вітні Гьюстон',
      'Порушення потреб безпеки',
      'Фази розвитку залежності',
      'Формування залежної поведінки в дитинстві',
      'Співзалежність та контрзалежність',
      'Проблема сорому в залежності',
      'Біблійна терапія залежності',
    ],
  },
  {
    number: '05',
    title: 'Робота з ПТСР. Основи травмофокусованої терапії в консультуванні',
    color: 'from-[#1C3A2E] to-[#2a4f3f]',
    items: [
      'Вступ в психотравматологію',
      'Що таке травма?',
      'Типи та причини ПТСР',
      'Біблійна етимологія травми',
      'Нейрофізіологія травми',
      'Вікно толерантності. Приклад Давида',
      'Обстеження на початку терапії. Принципи TF-терапії',
      'Фаза стабілізації. Психоедукація',
      'Значення біблійних стосунків в терапії травми',
      'Техніки етапу стабілізації',
      'Техніка опрацювання травми',
      'Техніки написання книги досвіду та терапевтичного письма',
      'Фінальний етап',
    ],
  },
  {
    number: '06',
    title: 'Духовні аспекти психологічного втручання. Еклезіологія в контексті співпраці біблійної терапії',
    color: 'from-[#D4A017] to-[#b88913]',
    items: [
      'Вступ. Що таке церква?',
      'Церква як зцілююча спільнота',
      'Фільтри душеопікунства в церковній культурі',
      'Побудова біблійного лідерства в церкві',
      'Задача зцілюючої біблійної близькості',
      'Ефект Дайнінга-Крюгера',
      'Копії духовних інструментів',
      'Духовні практики',
      'Зцілений контекст',
      'Сила спільноти',
      'Біблійна терапія Христа',
    ],
  },
  {
    number: '07',
    title: 'Кризове консультування',
    color: 'from-[#1C3A2E] to-[#2a4f3f]',
    items: [
      'Причини суїциду',
      'Формулювання стигми',
      'Помилки терапії та превенція',
      'Причини суїцидальності',
      'Модель базової вразливості',
      'З чого почати',
      'Типи питань',
      'План дій. Техніка 2 дороги',
      'Дві дороги та антисуїцидальний план',
      'Терапевтичні інструменти',
      'Терапія втрати',
      'Модель гострої і інтегрованої втрати',
      'Гостра реакція втрати',
      'Терапія травми насильства (1 та 2 частина)',
      'Терапевтичний урок "Фактори за життя"',
    ],
  },
  {
    number: '08',
    title: 'Психопатологія. Основи психіатрії в роботі біблійного терапевта',
    color: 'from-[#D4A017] to-[#b88913]',
    items: [
      'Задача і актуальність модулю',
      "Визначення психічного здоров'я",
      'Принцип континуума',
      'Розуміння вразливості',
      'Основні поняття психіатрії',
      'Методи психіатрії',
      'Основи нейробіології',
      'Духовна освіченість щодо психопатології',
      'Різниця між одержимістю і психічним розладом',
      'Психіатрія vs Одержимість',
    ],
  },
  {
    number: '09',
    title: 'Етика біблійного терапевта. Профілактика вигорання',
    color: 'from-[#1C3A2E] to-[#2a4f3f]',
    items: [
      'Етика біблійного терапевта. Конфіденційність',
      'Професійність та особистий розвиток біблійного терапевта',
      'Гендерні етичні особливості',
      'Загрози вигорання',
      'Причини вигорання',
      'Що робити з вигоранням?',
      'Заключне слово до програми',
    ],
  },
];

const format = [
  {
    icon: '🎬',
    title: 'Усі лекції в записі',
    desc: 'Навчайтесь у зручний для вас час — всі відеоуроки доступні на платформі',
  },
  {
    icon: '📝',
    title: 'Практичні завдання',
    desc: 'Після кожного уроку — завдання для закріплення, які перевіряють куратори',
  },
  {
    icon: '📞',
    title: 'Щомісячні дзвінки',
    desc: '9 зустрічей з кураторами навчання протягом усієї програми',
  },
  {
    icon: '👥',
    title: 'Інтервізійні групи',
    desc: 'Робота в малих групах — розбір кейсів, взаємопідтримка та ріст',
  },
  {
    icon: '✍️',
    title: 'Унікальні вправи',
    desc: 'Авторські вправи та завдання від Тетяни Шапошник включені в кожен модуль',
  },
  {
    icon: '🌟',
    title: 'Зустрічі з авторкою',
    desc: 'Особисті зустрічі з Тетяною Шапошник — авторкою програми',
  },
];

const outcomes = [
  'Сертифікат UIMP про завершення програми',
  'Практичні навички психологічного консультування',
  'Глибоке розуміння методу біблійної терапії',
  'Вміння працювати з депресією, тривогою, залежністю та ПТСР',
  'Навички кризового консультування та роботи з втратою',
  'Членство у спільноті практиків UIMP',
  'Доступ до бази знань та матеріалів',
  'Розуміння етики та профілактики вигорання',
];

const steps = [
  { step: '01', title: 'Натисніть "Вступити"', desc: 'Перейдіть на сторінку реєстрації та заповніть форму' },
  { step: '02', title: 'Оплата', desc: 'Щомісячний платіж — 1 000 грн. Перший місяць після реєстрації' },
  { step: '03', title: 'Доступ до платформи', desc: 'Отримайте доступ до всіх матеріалів першого модуля' },
  { step: '04', title: 'Навчання', desc: 'Дивіться уроки, виконуйте завдання, спілкуйтесь з куратором' },
  { step: '05', title: 'Сертифікат', desc: 'Завершіть усі 9 модулів та отримайте сертифікат UIMP' },
];

export default function LearningPage() {
  return (
    <main className={`min-h-screen bg-white ${inter.className}`}>

      <section className="relative overflow-hidden bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 -left-4 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#D4A017] rounded-full blur-3xl" />
        </div>
         <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="inline-block px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm">
                {"🎓 Сертифікаційна програма UIMP"}
              </div>
              <h1 className="text-5xl md:text-7xl font-bold leading-[1.05]">
                {"Основи християнської"}
                <br />
                <span className="text-[#D4A017]">{"психології 2.0"}</span>
              </h1>
              <p className="text-white/80 text-lg leading-relaxed max-w-xl">
                {"Повноцінна онлайн-програма з біблійної психотерапії. 9 модулів, практика, куратори та сертифікат. Як університет — але з серцем."}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href={SENDPULSE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center justify-center gap-2 bg-[#D4A017] text-white font-bold px-10 py-4 rounded-lg hover:bg-[#b88913] transition-all duration-300 text-lg"
                >
                  <span>{"Вступити на навчання"}</span>
                  <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
                </a>
                <Link
                  href="#modules"
                  className="inline-flex items-center justify-center px-8 py-4 border border-white/30 rounded-lg hover:bg-white/10 transition-all font-medium"
                >
                  {"Програма"}
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                {stats.map((s, i) => (
                  <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
                    <div className="text-2xl font-black text-[#D4A017]">{s.value}</div>
                    <div className="text-white/60 text-xs mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#D4A017] to-[#b88913] rounded-2xl rotate-3 opacity-20" />
              <div className="relative bg-white/10 backdrop-blur-sm p-8 rounded-2xl border border-white/20 space-y-4">
                <div className="relative h-48">
                  <Image
                    src="/courses/psychology-basics/uimp_wide-logo.webp.webp"
                    alt="UIMP Logo"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
                <div className="border-t border-white/20 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/70 text-sm">{"Щомісячний платіж"}</span>
                    <span className="text-[#D4A017] font-black text-2xl">{"1 000 грн"}</span>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white/70 text-sm">{"Тривалість"}</span>
                    <span className="text-white font-semibold">{"9 місяців"}</span>
                  </div>
                  <a
                    href={SENDPULSE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 bg-[#D4A017] text-white font-bold px-6 py-3 rounded-lg hover:bg-[#b88913] transition-all"
                  >
                    {"Вступити зараз"}
                    <FaArrowRight />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#FDF2EB] py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <FaQuoteLeft className="text-[#D4A017] text-4xl mx-auto mb-6 opacity-40" />
          <p className="text-xl md:text-2xl text-[#1C3A2E] font-medium leading-relaxed italic mb-6">
            {"«Це не просто курс. Це університетська програма, яка змінює те, як ви бачите людину, Бога і себе. Ми будуємо справжніх практиків.»"}
          </p>
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-0.5 bg-[#D4A017]" />
            <span className="font-bold text-[#1C3A2E]">{"Тетяна Шапошник"}</span>
            <span className="text-[#D4A017] text-sm">{"авторка програми"}</span>
            <div className="w-10 h-0.5 bg-[#D4A017]" />
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{"Формат"}</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">{"Як проходить навчання?"}</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {format.map((item, i) => (
            <div key={i} className="group bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-[#D4A017]/30">
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="text-lg font-bold text-[#1C3A2E] mb-3">{item.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#1C3A2E] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{"Авторка програми"}</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">{"Хто веде навчання?"}</h2>
          </div>
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="md:flex">
                <div className="md:w-1/3 relative h-64 md:h-auto">
                  <Image
                    src="/courses/psychiatry-basics/tetiana-shaposhnik.webp"
                    alt="Тетяна Шапошник"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="p-8 md:w-2/3">
                  <div className="flex items-center gap-2 mb-2">
                    {[1,2,3,4,5].map(i => <FaStar key={i} className="text-[#D4A017] text-sm" />)}
                  </div>
                  <h3 className="text-2xl font-bold text-[#1C3A2E] mb-1">{"Тетяна Шапошник"}</h3>
                  <p className="text-[#D4A017] text-sm mb-4">{"Президентка UIMP, психотерапевтка, авторка програми"}</p>
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">
                    {"15 років досвіду в психотерапії та душеопікунстві. Авторка методу біблійної терапії, за яким навчається понад 200 студентів з різних країн."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['15 років досвіду', 'Авторка методу', '200+ студентів'].map((tag, i) => (
                      <span key={i} className="bg-[#FDF2EB] text-[#1C3A2E] text-xs px-3 py-1 rounded-full font-medium">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="modules" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{"Навчальний план"}</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">{"9 модулів програми"}</h2>
          <p className="text-gray-500 mt-2">{"Усі лекції в записі · Практичні завдання · Перевірка кураторами"}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {modules.map((mod, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all overflow-hidden border border-gray-100">
              <div className={`h-1.5 bg-gradient-to-r ${mod.color}`} />
              <div className="p-8">
                <div className="flex items-start gap-4 mb-6">
                  <span className="text-5xl font-black text-[#1C3A2E]/10 leading-none flex-shrink-0">{mod.number}</span>
                  <h3 className="text-base font-bold text-[#1C3A2E] leading-snug pt-1">{mod.title}</h3>
                </div>
                <ul className="space-y-2">
                  {mod.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-3 text-gray-600">
                      <FaChevronRight className="text-[#D4A017] text-xs mt-1 flex-shrink-0" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#FDF2EB] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{"Результат"}</span>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">{"Що ви отримаєте після навчання?"}</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {outcomes.map((o, i) => (
              <div key={i} className="flex items-start gap-3 bg-white p-5 rounded-xl shadow-sm border border-white hover:border-[#D4A017]/30 transition-all hover:shadow-md">
                <FaCheckCircle className="text-[#D4A017] text-xl flex-shrink-0 mt-0.5" />
                <p className="text-gray-700 text-sm">{o}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{"Вступ"}</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">{"Як вступити?"}</h2>
        </div>
        <div className="relative">
          <div className="absolute top-6 left-0 right-0 h-0.5 bg-[#D4A017]/20 hidden lg:block" />
          <div className="grid md:grid-cols-5 gap-6 relative">
            {steps.map((s, i) => (
              <div key={i} className="text-center relative">
                <div className="w-12 h-12 bg-[#1C3A2E] text-white rounded-full flex items-center justify-center font-bold mx-auto mb-4 relative z-10">
                  {s.step}
                </div>
                <h3 className="font-bold text-[#1C3A2E] mb-2 text-sm">{s.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="relative bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] rounded-3xl overflow-hidden p-12 md:p-16">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-96 h-96 bg-[#D4A017] rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
          </div>
          <div className="relative text-center">
            <FaGraduationCap className="text-[#D4A017] text-6xl mx-auto mb-6" />
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">{"Готові вступити?"}</h2>
            <p className="text-white/70 text-lg mb-4 max-w-lg mx-auto">{"Щомісячний платіж"}</p>
            <div className="text-[#D4A017] text-5xl font-black mb-8">{"1 000 грн"}</div>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href={SENDPULSE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 bg-[#D4A017] text-white font-bold px-10 py-4 rounded-lg hover:bg-[#b88913] transition-all text-lg"
              >
                {"Вступити на навчання"}
                <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
              </a>
              <a
                href="https://t.me/shaposhnykpsy"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-white/30 text-white px-8 py-4 rounded-lg hover:bg-white/10 transition-all"
              >
                {"Запитати в Telegram"}
              </a>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}