import Link from 'next/link';
import { FaTelegram, FaInstagram, FaYoutube } from 'react-icons/fa';

export default function Footer() {
  return (
    <footer className="bg-[#1C3A2E] text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">

          {/* Про нас */}
          <div>
            <h3 className="font-bold text-[#D4A843] mb-3">{"UIMP"}</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              {"Український інститут психотерапії та душеопікунства"}
            </p>
          </div>

          {/* Посилання */}
          <div>
            <h3 className="font-bold text-[#D4A843] mb-3">{"Інформація"}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/privacy" className="text-white/60 hover:text-white transition-colors">
                  {"Політика конфіденційності"}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-white/60 hover:text-white transition-colors">
                  {"Умови використання"}
                </Link>
              </li>
              <li>
                <Link href="/contacts" className="text-white/60 hover:text-white transition-colors">
                  {"Контакти"}
                </Link>
              </li>
            </ul>
          </div>

          {/* Соцмережі */}
          <div>
            <h3 className="font-bold text-[#D4A843] mb-3">{"Ми в соцмережах"}</h3>
            <div className="flex gap-3">
              <Link href="https://t.me/shaposhnykpsy" target="_blank"
                className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-[#D4A843] transition-colors">
                <FaTelegram className="text-white text-sm" />
              </Link>
              <Link href="https://www.instagram.com/uimp_psychotherapy" target="_blank"
                className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-[#D4A843] transition-colors">
                <FaInstagram className="text-white text-sm" />
              </Link>
              <Link href="https://www.youtube.com/@bible_psychotherapy" target="_blank"
                className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-[#D4A843] transition-colors">
                <FaYoutube className="text-white text-sm" />
              </Link>
            </div>
          </div>

        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <p>{"© 2025 Ukrainian Institute of Psychotherapy. Всі права захищені."}</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-white transition-colors">{"Конфіденційність"}</Link>
            <Link href="/terms" className="hover:text-white transition-colors">{"Умови"}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}