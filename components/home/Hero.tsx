import Image from 'next/image';
import Link from 'next/link';

export default function Hero() {
  return (
    <section className="relative bg-gradient-to-r from-[#1C3A2E] to-[#2A4A3A] text-white py-20 overflow-hidden">
      {/* Анімований фон */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-20 w-64 h-64 bg-[#D4A017] rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-64 h-64 bg-white rounded-full blur-3xl animate-pulse animation-delay-2000"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 animate-fadeIn">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Український інститут <span className="text-[#D4A017]">психотерапії</span>
            </h1>
            <p className="text-xl mb-8 text-[#E8F5E0] max-w-2xl">
              Професійна освіта, турбота про психічне здоров'я та розвиток української психотерапевтичної спільноти
            </p>
            <div className="flex flex-wrap gap-4">
              <Link 
                href="/courses" 
                className="bg-[#D4A017] text-[#1C3A2E] px-8 py-3 rounded-lg font-semibold hover:bg-opacity-90 transition-all hover:scale-105"
              >
                Перейти до курсів
              </Link>
              <Link 
                href="/register" 
                className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-[#1C3A2E] transition-all hover:scale-105"
              >
                Зареєструватися
              </Link>
            </div>
          </div>
          <div className="flex-1 flex justify-center animate-fadeIn animation-delay-500">
            <div className="relative w-64 h-64 md:w-80 md:h-80">
              <Image
                src="/logo.jpg"
                alt="UIMP Logo"
                fill
                className="object-contain drop-shadow-2xl"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}