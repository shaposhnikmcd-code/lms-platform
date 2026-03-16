import Link from "next/link";
import { FaTelegram, FaInstagram, FaYoutube, FaEnvelope, FaChevronDown } from "react-icons/fa";

const faqs = [
  { q: "Як отримати доступ до курсу після оплати?", a: "Після успішної оплати курс автоматично з'являється у вашому кабінеті студента. Увійдіть в акаунт і перейдіть до розділу Мої курси." },
  { q: "Чи можна отримати сертифікат після завершення курсу?", a: "Так! Після проходження курсу на 100% сертифікат автоматично генерується і доступний для завантаження в кабінеті студента." },
  { q: "Скільки часу є доступ до курсу?", a: "Після оплати ви отримуєте довічний доступ до матеріалів курсу." },
  { q: "Як повернути кошти якщо курс не підійшов?", a: "Ми гарантуємо повернення коштів протягом 7 днів після оплати. Напишіть нам на email." },
  { q: "Чи можна навчатися з телефону?", a: "Так, платформа повністю адаптована для мобільних пристроїв." },
  { q: "Як стати викладачем UIMP?", a: "Напишіть нам на email з коротким описом вашої експертизи та досвіду." },
];

const socials = [
  { href: "https://t.me/shaposhnykpsy", icon: FaTelegram, label: "Telegram", color: "bg-[#0088cc]" },
  { href: "https://www.instagram.com/uimp_psychotherapy", icon: FaInstagram, label: "Instagram", color: "bg-gradient-to-br from-[#f09433] to-[#bc1888]" },
  { href: "https://www.youtube.com/@bible_psychotherapy", icon: FaYoutube, label: "YouTube", color: "bg-[#FF0000]" },
];

export default function ContactsPage() {
  return (
    <main className="min-h-screen bg-gray-50">

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] text-white py-10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{"Контакти"}</h1>
          <p className="text-white/70 text-lg">{"Маєте питання? Ми завжди раді допомогти"}</p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-16">

        {/* Контактні блоки */}
        <div className="grid md:grid-cols-2 gap-6 mb-16 max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center hover:shadow-md transition-all">
            <div className="w-14 h-14 bg-[#E8F5E0] rounded-full flex items-center justify-center mx-auto mb-4">
              <FaEnvelope className="text-[#1C3A2E] text-2xl" />
            </div>
            <h3 className="font-bold text-[#1C3A2E] text-lg mb-2">{"Email"}</h3>
            <a href="mailto:uimp.edu@gmail.com" className="text-[#D4A843] hover:text-[#b88913] transition-colors">
              {"uimp.edu@gmail.com"}
            </a>
            <p className="text-gray-400 text-sm mt-2">{"Відповідаємо протягом 24 годин"}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-8 text-center hover:shadow-md transition-all">
            <div className="w-14 h-14 bg-[#E8F5E0] rounded-full flex items-center justify-center mx-auto mb-4">
              <FaEnvelope className="text-[#1C3A2E] text-2xl" />
            </div>
            <h3 className="font-bold text-[#1C3A2E] text-lg mb-2">{"Технічна підтримка UIMP"}</h3>
            <a href="mailto:support@uimp.ua" className="text-[#D4A843] hover:text-[#b88913] transition-colors">
              {"support@uimp.ua"}
            </a>
            <p className="text-gray-400 text-sm mt-2">{"Відповідаємо протягом 24 годин"}</p>
          </div>
        </div>

        {/* Форма + соцмережі */}
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-sm p-8">
            <h2 className="text-2xl font-bold text-[#1C3A2E] mb-6">{"Написати нам"}</h2>
            <form action="https://formsubmit.co/uimp.edu@gmail.com" method="POST" className="space-y-4">
              <input type="hidden" name="_subject" value="Новий запит з сайту UIMP" />
              <input type="hidden" name="_captcha" value="false" />
              <input type="hidden" name="_next" value="https://dr-shaposhnik-platform.vercel.app/contacts?sent=true" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{"Ваше імʼя"}</label>
                <input type="text" name="name" required placeholder="Іван Петренко"
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C3A2E]/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{"Email"}</label>
                <input type="email" name="email" required placeholder="your@email.com"
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C3A2E]/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{"Повідомлення"}</label>
                <textarea name="message" required rows={5} placeholder="Ваше питання або повідомлення..."
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C3A2E]/20 resize-none" />
              </div>
              <button type="submit"
                className="w-full bg-[#1C3A2E] text-white font-medium py-3 rounded-xl hover:bg-[#2a5242] transition-colors">
                {"Надіслати повідомлення"}
              </button>
            </form>
          </div>

          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-2xl shadow-sm p-8">
              <h2 className="text-2xl font-bold text-[#1C3A2E] mb-6">{"Ми в соцмережах"}</h2>
              <div className="space-y-4">
                {socials.map((s) => (
                  <Link key={s.label} href={s.href} target="_blank"
                    className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-[#1C3A2E]/20 hover:shadow-sm transition-all group">
                    <div className={`w-12 h-12 ${s.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <s.icon className="text-white text-xl" />
                    </div>
                    <div>
                      <p className="font-medium text-[#1C3A2E] group-hover:text-[#D4A843] transition-colors">{s.label}</p>
                      <p className="text-xs text-gray-400">{"Підписуйтесь на нас"}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="bg-[#1C3A2E] rounded-2xl p-8 text-white">
              <h3 className="text-xl font-bold mb-2">{"Потрібна консультація?"}</h3>
              <p className="text-white/70 text-sm mb-4">{"Напишіть нам в Telegram — відповімо якнайшвидше"}</p>
              <Link href="https://t.me/shaposhnykpsy" target="_blank"
                className="inline-flex items-center gap-2 bg-[#0088cc] text-white px-6 py-3 rounded-xl hover:bg-[#0077bb] transition-colors font-medium">
                <FaTelegram /> {"Написати в Telegram"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-16">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-[#D4A843] font-semibold text-sm uppercase tracking-wider">{"Підтримка"}</span>
            <h2 className="text-3xl font-bold text-[#1C3A2E] mt-2">{"Часті запитання"}</h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <details key={i} className="group bg-gray-50 rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                  <span className="font-medium text-[#1C3A2E]">{faq.q}</span>
                  <FaChevronDown className="text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0 ml-4" />
                </summary>
                <div className="px-6 pb-6 text-gray-600 text-sm leading-relaxed">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

    </main>
  );
}