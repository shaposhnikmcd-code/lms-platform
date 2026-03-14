'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FaQuoteLeft, FaQuoteRight, FaHeart, FaBrain, FaUsers, FaPray } from 'react-icons/fa';

export default function AboutTetiana() {
  const videos = [
    { id: 1, videoId: '0sv8-OpW5R8', title: 'Чи можна християнину йти до психолога?' },
    { id: 2, videoId: 'Tp__54yrjOA', title: 'Як переживати невизначеність під час війни?' },
    { id: 3, videoId: '1DIPXtlZ508', title: 'Про життєстійкість та віру' },
  ];

  const specializations = [
    { icon: <FaBrain />, text: 'Депресивні та тривожні розлади' },
    { icon: <FaHeart />, text: 'Проблеми самооцінки' },
    { icon: <FaUsers />, text: 'Сімейні кризи та стосунки' },
    { icon: <FaPray />, text: 'Духовні та душевні кризи' },
  ];

  return (
    <section className="relative py-24 overflow-hidden bg-gradient-to-b from-white to-[#FDF2EB]">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-40 left-20 w-72 h-72 bg-[#D4A017] rounded-full blur-3xl"></div>
        <div className="absolute bottom-40 right-20 w-72 h-72 bg-[#1C3A2E] rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-[#1C3A2E] mt-2">Тетяна Шапошник</h2>
          <p className="text-gray-500 text-lg mt-3 max-w-2xl mx-auto">Засновниця UIMP, психолог, психотерапевт</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div className="space-y-8">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#D4A017] to-[#1C3A2E] rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
              <div className="relative bg-white p-2 rounded-3xl shadow-2xl">
                <div className="relative h-[500px] w-full rounded-2xl overflow-hidden">
                  <Image src="/Tetiana-Shaposhnyk/Tetiana-Shaposhnyk.webp" alt="Тетяна Шапошник" fill className="object-cover object-top" priority />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="relative group cursor-pointer">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[#D4A017] to-[#1C3A2E] rounded-xl blur opacity-30 group-hover:opacity-50 transition"></div>
                <div className="relative bg-white p-1 rounded-lg">
                  <div className="relative h-32 w-full rounded-lg overflow-hidden">
                    <Image src="/Tetiana-Shaposhnyk/diplomas.jpeg" alt="Дипломи" fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                  </div>
                  <p className="text-center text-sm font-medium text-[#1C3A2E] mt-2">Дипломи</p>
                </div>
              </div>
              <div className="relative group cursor-pointer">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[#D4A017] to-[#1C3A2E] rounded-xl blur opacity-30 group-hover:opacity-50 transition"></div>
                <div className="relative bg-white p-1 rounded-lg">
                  <div className="relative h-32 w-full rounded-lg overflow-hidden">
                    <Image src="/Tetiana-Shaposhnyk/certificate.jpeg" alt="Сертифікати" fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                  </div>
                  <p className="text-center text-sm font-medium text-[#1C3A2E] mt-2">Сертифікати</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="relative bg-white rounded-2xl shadow-xl p-8">
              <FaQuoteLeft className="absolute top-4 left-4 text-4xl text-[#D4A017] opacity-20" />
              <FaQuoteRight className="absolute bottom-4 right-4 text-4xl text-[#D4A017] opacity-20" />
              <p className="text-gray-600 italic text-lg leading-relaxed relative z-10">
                "Моя мета — допомогти людям знайти цілісність через поєднання професійної психології та християнських цінностей. Кожна людина унікальна і заслуговує на розуміння та підтримку."
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-bold text-[#1C3A2E] mb-4">Про фахівця</h3>
              <p className="text-gray-600 leading-relaxed">
                Практичний психолог, психотерапевт. Здійснює особисте, сімейне та пасторське консультування (душеопіка).
                Реалізує власні освітні курси з основ психології, психіатрії та душеопіки для християн, а також курс про життєстійкість.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-bold text-[#1C3A2E] mb-6">З чим працює</h3>
              <div className="grid grid-cols-2 gap-4">
                {specializations.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-[#FDF2EB] rounded-xl hover:bg-[#D4A017]/10 transition-colors group">
                    <div className="text-[#D4A017] text-xl group-hover:scale-110 transition-transform">{item.icon}</div>
                    <p className="text-sm text-gray-700">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Відео */}
        <div className="mt-16">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h3 className="text-2xl font-bold text-[#1C3A2E] mb-6">Інтерв'ю та виступи</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {videos.map((video) => (
                <div key={video.id} className="space-y-3">
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black shadow-lg">
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

        {/* Консультація */}
        <div className="mt-16 flex justify-center">
          <Link href="https://calendly.com/saposniktana878/50" target="_blank" rel="noopener noreferrer"
            className="group block bg-gradient-to-r from-[#1C3A2E] to-[#2a4f3f] rounded-2xl p-8 text-center hover:shadow-2xl transition-all max-w-2xl w-full">
            <div className="inline-block p-4 bg-[#D4A017] rounded-full mb-4 group-hover:scale-110 transition-transform">
              <FaHeart className="text-white text-2xl" />
            </div>
            <h4 className="text-2xl font-bold text-white mb-2">Записатись на консультацію</h4>
            <p className="text-white/80 text-sm">Оберіть зручний час у календарі</p>
          </Link>
        </div>

        {/* Соціальні мережі */}
        <div className="mt-8 bg-white rounded-2xl shadow-xl p-8 text-center">
          <h3 className="text-2xl font-bold text-[#1C3A2E] mb-2">Ми в соціальних мережах</h3>
          <p className="text-gray-500 mb-6">Слідкуйте за нами та отримуйте корисні матеріали щодня</p>
          <div className="flex justify-center gap-8">
            <Link href="https://t.me/shaposhnykpsy" target="_blank" className="flex flex-col items-center gap-2 group">
              <div className="bg-[#F0F9FF] p-4 rounded-2xl group-hover:bg-[#26A5E4] transition-all duration-300 shadow-md">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z" fill="#26A5E4"/>
                  <path d="M17.894 7.373l-2.185 10.301c-.165.737-.594.918-1.204.571l-3.33-2.452-1.607 1.547c-.178.178-.327.327-.67.327l.239-3.396 6.165-5.571c.268-.239-.058-.372-.414-.133L6.19 13.885l-3.27-1.022c-.711-.222-.726-.711.148-1.053l12.762-4.921c.593-.214 1.112.133.918 1.053l.146.43z" fill="white"/>
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-600 group-hover:text-[#26A5E4] transition-colors">Telegram</span>
            </Link>

            <Link href="https://www.instagram.com/uimp_psychotherapy" target="_blank" className="flex flex-col items-center gap-2 group">
              <div className="bg-[#FFF0F9] p-4 rounded-2xl group-hover:bg-[#d6249f] transition-all duration-300 shadow-md">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <defs>
                    <radialGradient id="ig3" cx="30%" cy="107%" r="150%">
                      <stop offset="0%" stopColor="#fdf497"/>
                      <stop offset="45%" stopColor="#fd5949"/>
                      <stop offset="60%" stopColor="#d6249f"/>
                      <stop offset="90%" stopColor="#285AEB"/>
                    </radialGradient>
                  </defs>
                  <rect width="24" height="24" rx="6" fill="url(#ig3)"/>
                  <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.8" fill="none"/>
                  <circle cx="17.5" cy="6.5" r="1.2" fill="white"/>
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-600 group-hover:text-[#d6249f] transition-colors">Instagram</span>
            </Link>

            <Link href="https://www.youtube.com/@bible_psychotherapy" target="_blank" className="flex flex-col items-center gap-2 group">
              <div className="bg-[#FFF0F0] p-4 rounded-2xl group-hover:bg-[#FF0000] transition-all duration-300 shadow-md">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805z" fill="#FF0000"/>
                  <path d="M9.609 15.601V8.408l6.264 3.602z" fill="white"/>
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-600 group-hover:text-[#FF0000] transition-colors">YouTube</span>
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
}