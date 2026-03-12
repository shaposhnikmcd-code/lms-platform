import Image from 'next/image';
import Link from 'next/link';

export default function Hero() {
  return (
    <section className="relative bg-gradient-to-r from-[#1C3A2E] to-[#2A4A3A] text-white py-20">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Український інститут психотерапії
            </h1>
            <p className="text-xl mb-8 text-[#E8F5E0]">
              Професійна освіта, турбота про психічне здоров'я та розвиток української психотерапевтичної спільноти
            </p>
            <div className="flex flex-wrap gap-4">
              <Link 
                href="/courses" 
                className="bg-[#D4A843] text-[#1C3A2E] px-8 py-3 rounded-lg font-semibold hover:bg-opacity-90 transition-all"
              >
                Перейти до курсів
              </Link>
              <Link 
                href="/register" 
                className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-[#1C3A2E] transition-all"
              >
                Зареєструватися
              </Link>
            </div>
          </div>
          <div className="flex-1 flex justify-center">
            <div className="relative w-64 h-64 md:w-80 md:h-80">
              <Image
                src="/logo.jpg"
                alt="UIMP Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}