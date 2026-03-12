// components/home/AboutTetiana.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { FaPlay, FaYoutube, FaInstagram, FaTelegram, FaQuoteLeft, FaQuoteRight, FaHeart, FaBrain, FaUsers, FaPray } from 'react-icons/fa';

export default function AboutTetiana() {
  const [activeVideo, setActiveVideo] = useState<number | null>(null);

  const videos = [
    { 
      id: 1, 
      videoId: '0sv8-OpW5R8', 
      title: 'Чи можна християнину йти до психолога?' 
    },
    { 
      id: 2, 
      videoId: 'Tp__54yrjOA', 
      title: 'Як переживати невизначеність під час війни?' 
    },
    { 
      id: 3, 
      videoId: '1DIPXtlZ508', 
      title: 'Про життєстійкість та віру' 
    },
  ];

  const specializations = [
    { icon: <FaBrain />, text: 'Депресивні та тривожні розлади' },
    { icon: <FaHeart />, text: 'Проблеми самооцінки' },
    { icon: <FaUsers />, text: 'Сімейні кризи та стосунки' },
    { icon: <FaPray />, text: 'Духовні та душевні кризи' },
  ];

  return (
    <section className="relative py-24 overflow-hidden bg-gradient-to-b from-white to-[#FDF2EB]">
      {/* Декоративні елементи */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-40 left-20 w-72 h-72 bg-[#D4A017] rounded-full blur-3xl"></div>
        <div className="absolute bottom-40 right-20 w-72 h-72 bg-[#1C3A2E] rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Заголовок */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-[#1C3A2E] mt-2">
            Тетяна Шапошник
          </h2>
          <p className="text-gray-500 text-lg mt-3 max-w-2xl mx-auto">
            Засновниця UIMP, психолог, психотерапевт
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Ліва колонка - фото і дипломи */}
          <div className="space-y-8">
            {/* Головне фото */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#D4A017] to-[#1C3A2E] rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
              <div className="relative bg-white p-2 rounded-3xl shadow-2xl">
                <div className="relative h-[500px] w-full rounded-2xl overflow-hidden">
                  <Image
                    src="/Tetiana-Shaposhnyk/Tetiana-Shaposhnyk.webp"
                    alt="Тетяна Шапошник"
                    fill
                    className="object-cover object-top"
                    priority
                  />
                  {/* Градієнт для тексту */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                  
                  {/* Інформація на фото */}
                  <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-8 bg-[#D4A017] rounded-full"></div>
                      <p className="text-2xl font-bold">Тетяна Шапошник</p>
                    </div>
                    <p className="text-white/80 text-sm">15+ років досвіду • 1000+ клієнтів</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Сітка дипломів - формат .jpeg */}
            <div className="grid grid-cols-2 gap-4">
              <div className="relative group cursor-pointer">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[#D4A017] to-[#1C3A2E] rounded-xl blur opacity-30 group-hover:opacity-50 transition"></div>
                <div className="relative bg-white p-1 rounded-lg">
                  <div className="relative h-32 w-full rounded-lg overflow-hidden">
                    <Image
                      src="/Tetiana-Shaposhnyk/diplomas.jpeg"
                      alt="Дипломи"
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  <p className="text-center text-sm font-medium text-[#1C3A2E] mt-2">Дипломи</p>
                </div>
              </div>
              <div className="relative group cursor-pointer">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[#D4A017] to-[#1C3A2E] rounded-xl blur opacity-30 group-hover:opacity-50 transition"></div>
                <div className="relative bg-white p-1 rounded-lg">
                  <div className="relative h-32 w-full rounded-lg overflow-hidden">
                    <Image
                      src="/Tetiana-Shaposhnyk/certificate.jpeg"
                      alt="Сертифікати"
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  <p className="text-center text-sm font-medium text-[#1C3A2E] mt-2">Сертифікати</p>
                </div>
              </div>
            </div>
          </div>

          {/* Права колонка - інформація */}
          <div className="space-y-8">
            {/* Цитата */}
            <div className="relative bg-white rounded-2xl shadow-xl p-8">
              <FaQuoteLeft className="absolute top-4 left-4 text-4xl text-[#D4A017] opacity-20" />
              <FaQuoteRight className="absolute bottom-4 right-4 text-4xl text-[#D4A017] opacity-20" />
              <p className="text-gray-600 italic text-lg leading-relaxed relative z-10">
                "Моя мета — допомогти людям знайти цілісність через поєднання професійної психології та християнських цінностей. Кожна людина унікальна і заслуговує на розуміння та підтримку."
              </p>
            </div>

            {/* Про фахівця */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-bold text-[#1C3A2E] mb-4">Про фахівця</h3>
              <p className="text-gray-600 leading-relaxed">
                Практичний психолог, психотерапевт. Здійснює особисте, сімейне та пасторське консультування (душеопіка). 
                Реалізує власні освітні курси з основ психології, психіатрії та душеопіки для християн, а також курс про життєстійкість.
              </p>
            </div>

            {/* З чим працює */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-bold text-[#1C3A2E] mb-6">З чим працює</h3>
              <div className="grid grid-cols-2 gap-4">
                {specializations.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-[#FDF2EB] rounded-xl hover:bg-[#D4A017]/10 transition-colors group">
                    <div className="text-[#D4A017] text-xl group-hover:scale-110 transition-transform">
                      {item.icon}
                    </div>
                    <p className="text-sm text-gray-700">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Відео з YouTube - НА ВСЮ ШИРИНУ */}
        <div className="mt-16">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h3 className="text-2xl font-bold text-[#1C3A2E] mb-6">Інтерв'ю та виступи</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {videos.map((video) => (
                <div key={video.id} className="space-y-3">
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black shadow-lg group">
                    <iframe
                      src={`https://www.youtube.com/embed/${video.videoId}`}
                      title={video.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 w-full h-full"
                    ></iframe>
                  </div>
                  <p className="text-sm text-gray-700 font-medium line-clamp-2">{video.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Кнопка на консультацію - ПО ЦЕНТРУ */}
        <div className="mt-16 flex justify-center">
          <Link
            href="https://calendly.com/saposniktana878/50"
            target="_blank"
            rel="noopener noreferrer"
            className="group block bg-gradient-to-r from-[#1C3A2E] to-[#2a4f3f] rounded-2xl p-8 text-center hover:shadow-2xl transition-all max-w-2xl w-full"
          >
            <div className="inline-block p-4 bg-[#D4A017] rounded-full mb-4 group-hover:scale-110 transition-transform">
              <FaHeart className="text-white text-2xl" />
            </div>
            <h4 className="text-2xl font-bold text-white mb-2">Записатись на консультацію</h4>
            <p className="text-white/80 text-sm">Оберіть зручний час у календарі</p>
          </Link>
        </div>

        {/* Соціальні мережі - ПО ЦЕНТРУ */}
        <div className="mt-8 flex justify-center gap-4">
          <Link href="https://t.me/shaposhnykpsy" target="_blank" className="bg-[#FDF2EB] p-4 rounded-full hover:bg-[#D4A017] group transition-all">
            <FaTelegram className="text-[#1C3A2E] text-xl group-hover:text-white" />
          </Link>
          <Link href="https://www.instagram.com/uimp_psychotherapy" target="_blank" className="bg-[#FDF2EB] p-4 rounded-full hover:bg-[#D4A017] group transition-all">
            <FaInstagram className="text-[#1C3A2E] text-xl group-hover:text-white" />
          </Link>
          <Link href="https://www.youtube.com/@bible_psychotherapy" target="_blank" className="bg-[#FDF2EB] p-4 rounded-full hover:bg-[#D4A017] group transition-all">
            <FaYoutube className="text-[#1C3A2E] text-xl group-hover:text-white" />
          </Link>
        </div>
      </div>
    </section>
  );
}