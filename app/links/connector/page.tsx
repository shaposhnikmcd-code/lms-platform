// app/links/connector/page.tsx
'use client';

import Link from 'next/link';
import { FaTelegram, FaYoutube, FaInstagram } from 'react-icons/fa';
import { IoMdShare } from 'react-icons/io';
import { IoArrowBack } from 'react-icons/io5';
import Image from 'next/image';
import { useState } from 'react';
import OrderForm from '@/components/connector/OrderForm';

export default function ConnectorPage() {
  const [showOrderForm, setShowOrderForm] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0c4a3a] to-[#06382d] p-6">
      <div className="container mx-auto max-w-[500px]">
        
        {/* Головна картка */}
        <div className="bg-[#003d30] rounded-[32px] p-5 md:p-6 shadow-2xl relative">
          
          {/* Верхня ліва кнопка назад */}
          <Link 
            href="/links"
            className="absolute top-4 left-4 w-[38px] h-[38px] bg-[#E0E0E0] rounded-full flex items-center justify-center hover:opacity-80 transition-all z-10"
          >
            <IoArrowBack className="text-[#003d30] text-lg" />
          </Link>

          {/* Верхня права кнопка share */}
          <button className="absolute top-4 right-4 w-[38px] h-[38px] bg-[#E0E0E0] rounded-full flex items-center justify-center hover:opacity-80 transition-all z-10">
            <IoMdShare className="text-[#003d30] text-lg" />
          </button>

          {/* Центральний контент */}
          <div className="flex flex-col items-center justify-center mt-16">
            
            {/* Фото гри */}
            <div className="w-full mb-8">
              <div className="relative w-full h-auto aspect-square scale-125">
                <Image
                  src="/Connector game.jpg"
                  alt="Гра Конектор"
                  fill
                  className="object-contain"
                  priority
                  quality={100}
                />
              </div>
            </div>

            {/* Назва */}
            <h1 className="text-[#E8E3C9] text-3xl font-bold text-center mt-8 mb-1">
              КОНЕКТОР
            </h1>
            <p className="text-[#CFC8A9] text-center text-sm mb-4">
              психологічна гра для пар
            </p>

            {/* Соціальні іконки */}
            <div className="flex justify-center gap-4 mb-5">
              <Link href="https://t.me/shaposhnykpsy" target="_blank" className="text-[#E8E3C9] hover:text-white transition-colors">
                <FaTelegram size={22} />
              </Link>
              <Link href="https://www.youtube.com/@bible_psychotherapy" target="_blank" className="text-[#E8E3C9] hover:text-white transition-colors">
                <FaYoutube size={22} />
              </Link>
              <Link href="https://www.instagram.com/uimp_psychotherapy" target="_blank" className="text-[#E8E3C9] hover:text-white transition-colors">
                <FaInstagram size={22} />
              </Link>
            </div>

            {/* Що входить в гру */}
            <div className="w-full mb-4">
              <h2 className="text-[#E8E3C9] text-base font-semibold mb-3 text-center">
                У наборі:
              </h2>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#1a5a48] p-3 rounded-[12px]">
                  <div className="text-[#E8E3C9] font-bold text-2xl leading-tight">25</div>
                  <div className="text-[#CFC8A9] text-[10px]">карток з діями</div>
                </div>
                <div className="bg-[#1a5a48] p-3 rounded-[12px]">
                  <div className="text-[#E8E3C9] font-bold text-2xl leading-tight">25</div>
                  <div className="text-[#CFC8A9] text-[10px]">карток 18+</div>
                </div>
                <div className="bg-[#1a5a48] p-3 rounded-[12px]">
                  <div className="text-[#E8E3C9] font-bold text-2xl leading-tight">100</div>
                  <div className="text-[#CFC8A9] text-[10px]">тематичних питань</div>
                </div>
              </div>
              <p className="text-[#CFC8A9] text-xs text-center mt-2">
                Загалом 150 карток
              </p>
            </div>

            {/* Опис */}
            <div className="w-full space-y-2 mb-4">
              <p className="text-[#E8E3C9] text-xs leading-relaxed">
                Гра створена професійними психологами, психотерапевтами та спеціалістами 
                Українського інституту Душеопіки та Психотерапії.
              </p>
              
              <p className="text-[#E8E3C9] text-xs leading-relaxed">
                Допомагає парам краще зрозуміти один одного, відкрити емоції партнера, 
                підвищити емоційну близькість.
              </p>

              <div className="bg-[#d4a62b]/20 p-3 rounded-lg border border-[#d4a62b]/30">
                <p className="text-[#E8E3C9] text-xs italic">
                  "Гра допомагає звернутися до Бога як джерела любові."
                </p>
              </div>
            </div>

            {/* Ціна та доставка */}
            <div className="w-full bg-[#E8E3C9] rounded-xl p-4">
              <div className="text-center mb-2">
                <span className="text-[#003d30] text-2xl font-bold">1099</span>
                <span className="text-[#003d30] text-base"> грн</span>
              </div>
              
              <div className="space-y-1 mb-3">
                <p className="text-[#003d30]/70 text-[10px] flex items-center gap-2">
                  <span>📦</span> Доставка оплачується покупцем
                </p>
              </div>

              {/* Кнопка замовлення - тепер відкриває форму */}
              <button
                onClick={() => setShowOrderForm(true)}
                className="block w-full bg-[#d4a62b] text-[#003d30] py-3 rounded-lg font-bold text-sm text-center hover:bg-[#c49520] transition-all"
              >
                Замовити
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Форма замовлення */}
      <OrderForm 
        isOpen={showOrderForm} 
        onClose={() => setShowOrderForm(false)} 
      />
    </div>
  );
}