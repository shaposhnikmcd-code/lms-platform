import Link from "next/link";
import { FaTelegram, FaInstagram, FaYoutube, FaEnvelope, FaChevronDown } from "react-icons/fa";
import { getTranslatedContent } from "@/lib/translate";
import { contactsContent } from "./_content/uk";

const getContent = getTranslatedContent(contactsContent, "contacts-page");

const socialLinks = [
  { href: "https://t.me/shaposhnykpsy", icon: FaTelegram, label: "Telegram", color: "bg-[#0088cc]" },
  { href: "https://www.instagram.com/uimp_psychotherapy", icon: FaInstagram, label: "Instagram", color: "bg-gradient-to-br from-[#f09433] to-[#bc1888]" },
  { href: "https://www.youtube.com/@bible_psychotherapy", icon: FaYoutube, label: "YouTube", color: "bg-[#FF0000]" },
];

export default async function ContactsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);

  return (
    <main className="min-h-screen bg-gray-50">

      <section className="bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] text-white py-10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{c.title}</h1>
          <p className="text-white/70 text-lg">{c.subtitle}</p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-6 mb-16 max-w-2xl mx-auto">
          {c.contacts.map((contact, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm p-8 text-center hover:shadow-md transition-all">
              <div className="w-14 h-14 bg-[#E8F5E0] rounded-full flex items-center justify-center mx-auto mb-4">
                <FaEnvelope className="text-[#1C3A2E] text-2xl" />
              </div>
              <h3 className="font-bold text-[#1C3A2E] text-lg mb-2">{contact.title}</h3>
              <a href={`mailto:${contact.email}`} className="text-[#D4A843] hover:text-[#b88913] transition-colors">
                {contact.email}
              </a>
              <p className="text-gray-400 text-sm mt-2">{c.emailResponseTime}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-sm p-8">
            <h2 className="text-2xl font-bold text-[#1C3A2E] mb-6">{c.form.title}</h2>
            <form action="https://formsubmit.co/uimp.edu@gmail.com" method="POST" className="space-y-4">
              <input type="hidden" name="_subject" value="Новий запит з сайту UIMP" />
              <input type="hidden" name="_captcha" value="false" />
              <input type="hidden" name="_next" value="https://www.uimp.com.ua/contacts?sent=true" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{c.form.namLabel}</label>
                <input type="text" name="name" required placeholder={c.form.namePlaceholder}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C3A2E]/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{c.form.emailLabel}</label>
                <input type="email" name="email" required placeholder="your@email.com"
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C3A2E]/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{c.form.messageLabel}</label>
                <textarea name="message" required rows={5} placeholder={c.form.messagePlaceholder}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C3A2E]/20 resize-none" />
              </div>
              <button type="submit"
                className="w-full bg-[#1C3A2E] text-white font-medium py-3 rounded-xl hover:bg-[#2a5242] transition-colors">
                {c.form.btnSubmit}
              </button>
            </form>
          </div>

          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-2xl shadow-sm p-8">
              <h2 className="text-2xl font-bold text-[#1C3A2E] mb-6">{c.social.title}</h2>
              <div className="space-y-4">
                {socialLinks.map((s) => (
                  <Link key={s.label} href={s.href} target="_blank"
                    className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-[#1C3A2E]/20 hover:shadow-sm transition-all group">
                    <div className={`w-12 h-12 ${s.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <s.icon className="text-white text-xl" />
                    </div>
                    <div>
                      <p className="font-medium text-[#1C3A2E] group-hover:text-[#D4A843] transition-colors">{s.label}</p>
                      <p className="text-xs text-gray-400">{c.social.followLabel}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="bg-[#1C3A2E] rounded-2xl p-8 text-white">
              <h3 className="text-xl font-bold mb-2">{c.telegram.title}</h3>
              <p className="text-white/70 text-sm mb-4">{c.telegram.subtitle}</p>
              <Link href="https://t.me/shaposhnykpsy" target="_blank"
                className="inline-flex items-center gap-2 bg-[#0088cc] text-white px-6 py-3 rounded-xl hover:bg-[#0077bb] transition-colors font-medium">
                <FaTelegram /> {c.telegram.btn}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-[#D4A843] font-semibold text-sm uppercase tracking-wider">{c.faq.label}</span>
            <h2 className="text-3xl font-bold text-[#1C3A2E] mt-2">{c.faq.title}</h2>
          </div>
          <div className="space-y-4">
            {c.faq.items.map((faq, i) => (
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