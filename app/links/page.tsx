'use client';

import CookieBanner from '@/components/CookieBanner';
import Link from 'next/link';
import { useState } from 'react';
import Image from 'next/image';
import { FaTelegram, FaYoutube, FaInstagram, FaEnvelope, FaStar, FaShareAlt } from 'react-icons/fa';

// Дані для посилань - нова послідовність
const links = [
  {
    title: 'Навчальні курси',
    href: '/courses'
  },
  {
    title: 'Консультація Тетяни Шапошник',
    href: '/links/consultation',
    external: true
  },
  {
    title: 'Простір турботи',
    href: '/care-space'
  },
  {
    title: 'База душеопікунів',
    href: '/counselors'
  },
  {
    title: 'Технічна підтримка UIMP',
    href: 'mailto:support@uimp.ua',
    external: true
  }
];

export default function LinksPage() {
  const [showQR, setShowQR] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b3d2e] to-[#022d23] p-4">
      <div className="container mx-auto max-w-md">
        
        {/* Головна картка */}
        <div className="bg-[#003d30] rounded-[32px] p-8 md:p-10 shadow-2xl relative">
          
          {/* Верхня ліва кнопка (зірочка) */}
          <button className="absolute top-6 left-6 w-10 h-10 bg-[#d9d9d9] rounded-full flex items-center justify-center hover:opacity-80 transition-all">
            <FaStar className="text-[#003d30] text-lg" />
          </button>

          {/* Верхня права кнопка (поділитися) */}
          <button 
            onClick={() => setShowQR(!showQR)}
            className="absolute top-6 right-6 w-10 h-10 bg-[#d9d9d9] rounded-full flex items-center justify-center hover:opacity-80 transition-all"
          >
            <FaShareAlt className="text-[#003d30] text-lg" />
          </button>

          {/* QR код (показується при натисканні) */}
          {showQR && (
            <div className="absolute top-20 right-6 bg-white p-4 rounded-lg text-center z-10 shadow-xl w-48">
              <h3 className="text-[#003d30] font-bold mb-3 text-sm">
                QR код
              </h3>
              <div className="flex justify-center mb-3">
                <div className="w-32 h-32 bg-gray-200 flex items-center justify-center rounded-lg">
                  <span className="text-gray-500 text-xs">QR код</span>
                </div>
              </div>
              <button
                onClick={() => setShowQR(false)}
                className="text-[#003d30] underline text-xs"
              >
                Закрити
              </button>
            </div>
          )}

          {/* Центральний контент */}
          <div className="flex flex-col items-center justify-center mt-4">
            
            {/* Біле коло з оригінальним логотипом */}
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-lg overflow-hidden">
              <div className="relative w-16 h-16">
                <Image
                  src="/logo-white.webp"
                  alt="UIMP"
                  fill
                  className="object-contain"
                />
              </div>
            </div>

            {/* Заголовок */}
            <h1 className="text-[#e7e2c6] text-2xl md:text-3xl font-bold text-center mb-8">
              База посилань UMP
            </h1>

            {/* Соціальні іконки горизонтально */}
            <div className="flex justify-center gap-6 mb-8">
              <Link href="https://t.me/shaposhnykpsy" target="_blank" className="text-[#e7e2c6] hover:text-white transition-colors">
                <FaTelegram size={28} />
              </Link>
              <Link href="https://www.youtube.com/@bible_psychotherapy" target="_blank" className="text-[#e7e2c6] hover:text-white transition-colors">
                <FaYoutube size={28} />
              </Link>
              <Link href="https://www.instagram.com/uimp_psychotherapy" target="_blank" className="text-[#e7e2c6] hover:text-white transition-colors">
                <FaInstagram size={28} />
              </Link>
              <Link href="mailto:info@uimp.ua" className="text-[#e7e2c6] hover:text-white transition-colors">
                <FaEnvelope size={28} />
              </Link>
            </div>

            {/* Список посилань вертикально */}
            <div className="w-full space-y-2 mt-4">
              {links.map((link, index) => (
                <Link
                  key={index}
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                  className="block bg-[#e7e2c6] hover:bg-white transition-colors px-4 py-3 text-center rounded-lg w-full"
                >
                  <span className="text-[#003d30] text-sm font-medium">
                    {link.title}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Текст внизу */}
        <div className="mt-6 text-center">
          <p className="text-white/40 text-xs">
            Join uimp_psychotherapy1 on Linktree
          </p>
          <div className="flex justify-center gap-2 mt-2 text-white/30 text-xs">
            <button className="hover:text-white/60 transition-colors">Cookie Preferences</button>
            <span>•</span>
            <button className="hover:text-white/60 transition-colors">Report</button>
            <span>•</span>
            <button className="hover:text-white/60 transition-colors">Privacy</button>
            <span>•</span>
            <button className="hover:text-white/60 transition-colors">Explore</button>
          </div>
        </div>
      </div>
    </div>
  );
}