import Link from "next/link";
import { FaGraduationCap, FaClock, FaCheckCircle, FaBookOpen, FaArrowRight, FaVideo, FaFileAlt, FaComments } from "react-icons/fa";

const semesters = [
  {
    number: "01",
    title: "Перший семестр",
    duration: "3 місяці",
    subjects: [
      { name: "Вступ до біблійної психології", hours: 30 },
      { name: "Основи психотерапії", hours: 24 },
      { name: "Психологія особистості", hours: 28 },
    ],
  },
  {
    number: "02",
    title: "Другий семестр",
    duration: "3 місяці",
    subjects: [
      { name: "Методи консультування", hours: 32 },
      { name: "Групова динаміка", hours: 20 },
      { name: "Практикум: перші кейси", hours: 40 },
    ],
  },
  {
    number: "03",
    title: "Третій семестр",
    duration: "3 місяці",
    subjects: [
      { name: "Психіатрія для психологів", hours: 24 },
      { name: "Сімейна терапія", hours: 28 },
      { name: "Супервізія та самоаналіз", hours: 30 },
    ],
  },
  {
    number: "04",
    title: "Четвертий семестр",
    duration: "3 місяці",
    subjects: [
      { name: "Спеціалізація за напрямком", hours: 36 },
      { name: "Дипломна практика", hours: 60 },
      { name: "Захист дипломної роботи", hours: 10 },
    ],
  },
];

const format = [
  { icon: FaVideo, title: "Живі онлайн пари", desc: "Заняття в реальному часі з викладачем через відеозв'язок. Розклад відомий заздалегідь." },
  { icon: FaFileAlt, title: "Домашні завдання", desc: "Після кожної теми — практичне завдання для закріплення матеріалу." },
  { icon: FaComments, title: "Тести та сесії", desc: "Після кожного семестру — тестування знань та захист практичних робіт." },
  { icon: FaGraduationCap, title: "Супервізія", desc: "Регулярні зустрічі з куратором для розбору реальних кейсів та підтримки." },
];

const teachers = [
  { name: "Тетяна Шапошник", role: "Президентка UIMP", spec: "Психотерапевт, авторка програми", exp: "15 років досвіду" },
  { name: "Марта Холява", role: "Директорка консультаційного центру", spec: "Психологиня-консультантка", exp: "10+ років практики" },
  { name: "Ім'я викладача", role: "Роль в інституті", spec: "Спеціалізація", exp: "Досвід" },
];

const outcomes = [
  "Офіційний диплом/сертифікат UIMP",
  "Практичні навички психологічного консультування",
  "Глибоке розуміння біблійної психотерапії",
  "Доступ до бази знань та матеріалів назавжди",
  "Членство в спільноті випускників UIMP",
  "Право на приватну практику під брендом UIMP",
];

const steps = [
  { step: "01", title: "Подайте заявку", desc: "Заповніть форму або напишіть в Telegram" },
  { step: "02", title: "Співбесіда", desc: "Коротка зустріч з куратором онлайн" },
  { step: "03", title: "Оплата та зарахування", desc: "Оберіть формат оплати і отримайте доступ" },
  { step: "04", title: "Навчання", desc: "Відвідуйте пари, здавайте завдання, спілкуйтесь з куратором" },
  { step: "05", title: "Диплом", desc: "Захистіть дипломну роботу та отримайте сертифікат" },
];

export default function ProgramPage() {
  return (
    <main className="min-h-screen bg-white">

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] text-white py-24">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 -left-4 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#D4A843] rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 text-center">
          <div className="inline-block px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm mb-6">
            Сертифікаційна програма UIMP
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Навчання в інституті<br />психотерапії
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto mb-10">
            Повноцінне онлайн-навчання з живими парами, тестами, супервізією та дипломом. Як університет — але онлайн і з біблійною основою.
          </p>
          <div className="flex flex-wrap justify-center gap-6 mb-10">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 text-center">
              <div className="text-3xl font-bold text-[#D4A843]">1 рік</div>
              <div className="text-white/70 text-sm">тривалість</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 text-center">
              <div className="text-3xl font-bold text-[#D4A843]">4</div>
              <div className="text-white/70 text-sm">семестри</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 text-center">
              <div className="text-3xl font-bold text-[#D4A843]">онлайн</div>
              <div className="text-white/70 text-sm">формат</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 text-center">
              <div className="text-3xl font-bold text-[#D4A843]">200+</div>
              <div className="text-white/70 text-sm">випускників</div>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="#enroll"
              className="inline-flex items-center gap-2 bg-[#D4A843] text-white font-medium px-8 py-4 rounded-xl hover:bg-[#b88913] transition-all">
              Вступити на навчання <FaArrowRight />
            </Link>
            <Link href="#semesters"
              className="inline-flex items-center px-8 py-4 border border-white/30 rounded-xl hover:bg-white/10 transition-all">
              Структура навчання
            </Link>
          </div>
        </div>
      </section>

      {/* ФОРМАТ */}
      <section className="bg-[#F9F6F0] py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-[#D4A843] font-semibold text-sm uppercase tracking-wider">Формат</span>
            <h2 className="text-3xl font-bold text-[#1C3A2E] mt-2">Як проходить навчання?</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {format.map((f, i) => (
              <div key={i} className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-all text-center">
                <div className="w-14 h-14 bg-[#E8F5E0] rounded-full flex items-center justify-center mx-auto mb-4">
                  <f.icon className="text-[#1C3A2E] text-2xl" />
                </div>
                <h3 className="font-bold text-[#1C3A2E] mb-3">{f.title}</h3>
                <p className="text-gray-600 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* СЕМЕСТРИ */}
      <section id="semesters" className="max-w-5xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <span className="text-[#D4A843] font-semibold text-sm uppercase tracking-wider">Навчальний план</span>
          <h2 className="text-3xl font-bold text-[#1C3A2E] mt-2">Структура навчання</h2>
          <p className="text-gray-500 mt-2">4 семестри, 1 рік, живі пари щотижня</p>
        </div>
        <div className="space-y-4">
          {semesters.map((s, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all">
              <div className={`h-1 ${i % 2 === 0 ? "bg-[#1C3A2E]" : "bg-[#D4A843]"}`} />
              <div className="p-6 flex items-start gap-6">
                <div className="text-5xl font-black text-[#1C3A2E]/10 flex-shrink-0 leading-none">{s.number}</div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <h3 className="text-lg font-bold text-[#1C3A2E]">{s.title}</h3>
                    <span className="text-xs bg-[#E8F5E0] text-[#1C3A2E] px-2 py-1 rounded-full flex items-center gap-1">
                      <FaClock className="text-xs" /> {s.duration}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {s.subjects.map((sub, j) => (
                      <div key={j} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-2">
                          <FaBookOpen className="text-[#D4A843] text-xs flex-shrink-0" />
                          <span className="text-sm text-gray-700">{sub.name}</span>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">{sub.hours} год.</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ВИКЛАДАЧІ */}
      <section className="bg-[#1C3A2E] py-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-[#D4A843] font-semibold text-sm uppercase tracking-wider">Команда</span>
            <h2 className="text-3xl font-bold text-white mt-2">Викладачі</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {teachers.map((t, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 text-center">
                <div className="w-20 h-20 bg-[#D4A843] rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-white">
                  {t.name[0]}
                </div>
                <h3 className="font-bold text-white text-lg mb-1">{t.name}</h3>
                <p className="text-[#D4A843] text-sm mb-1">{t.role}</p>
                <p className="text-white/60 text-xs mb-3">{t.spec}</p>
                <span className="inline-block bg-white/10 text-white/80 text-xs px-3 py-1 rounded-full">{t.exp}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ЩО ОТРИМАЄ ВИПУСКНИК */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <span className="text-[#D4A843] font-semibold text-sm uppercase tracking-wider">Результат</span>
          <h2 className="text-3xl font-bold text-[#1C3A2E] mt-2">Що ви отримаєте після навчання?</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {outcomes.map((o, i) => (
            <div key={i} className="flex items-start gap-4 bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <FaCheckCircle className="text-[#D4A843] text-xl flex-shrink-0 mt-0.5" />
              <p className="text-gray-700">{o}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ЯК ВСТУПИТИ */}
      <section className="bg-[#F9F6F0] py-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-[#D4A843] font-semibold text-sm uppercase tracking-wider">Вступ</span>
            <h2 className="text-3xl font-bold text-[#1C3A2E] mt-2">Як вступити?</h2>
          </div>
          <div className="grid md:grid-cols-5 gap-4">
            {steps.map((s, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 bg-[#1C3A2E] text-white rounded-full flex items-center justify-center font-bold mx-auto mb-4">
                  {s.step}
                </div>
                <h3 className="font-bold text-[#1C3A2E] mb-2 text-sm">{s.title}</h3>
                <p className="text-gray-500 text-xs">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="enroll" className="max-w-5xl mx-auto px-4 py-20">
        <div className="relative bg-gradient-to-r from-[#1C3A2E] to-[#2a4f3f] rounded-3xl overflow-hidden p-12 text-center">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-64 h-64 bg-[#D4A843] rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl" />
          </div>
          <div className="relative">
            <FaGraduationCap className="text-[#D4A843] text-5xl mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-white mb-4">Готові вступити?</h2>
            <p className="text-white/70 mb-8 max-w-lg mx-auto">
              Залиште заявку або задайте питання нашому куратору — відповімо протягом 24 годин
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/contacts"
                className="inline-flex items-center gap-2 bg-[#D4A843] text-white font-medium px-8 py-4 rounded-xl hover:bg-[#b88913] transition-all">
                Вступити на навчання <FaArrowRight />
              </Link>
              <Link href="https://t.me/shaposhnykpsy" target="_blank"
                className="inline-flex items-center gap-2 border border-white/30 text-white px-8 py-4 rounded-xl hover:bg-white/10 transition-all">
                Запитати в Telegram
              </Link>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}