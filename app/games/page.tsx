// app/games/page.tsx
import Link from 'next/link';
import Image from 'next/image';
import { FaArrowRight } from 'react-icons/fa';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export default function GamesPage() {
  const games = [
    {
      id: 1,
      title: 'Гра "Конектор"',
      description: 'Набір карток для знайомств та зближення. Допомагає створити глибокі та довірливі стосунки.',
      price: '1099 грн',
      features: ['25/25/100 карток', 'Для пар та компаній', 'Розвиває емпатію'],
      image: '/Connector game.jpg',
      href: '/links/connector'
    }
  ];

  return (
    <main className={`min-h-screen bg-gradient-to-b from-[#FDF2EB] to-white ${inter.className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        
        {/* Заголовок */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-[#1C3A2E] mb-4">
            Ігри для розвитку
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Настільні ігри, що допомагають краще пізнати себе та інших
          </p>
        </div>

        {/* Сітка ігор */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {games.map((game) => (
            <Link
              key={game.id}
              href={game.href}
              className="group bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
            >
              {/* Зображення */}
              <div className="relative h-64 w-full overflow-hidden">
                <Image
                  src={game.image}
                  alt={game.title}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>

              {/* Контент */}
              <div className="p-6">
                <h2 className="text-2xl font-bold text-[#1C3A2E] mb-2">{game.title}</h2>
                <p className="text-gray-600 text-sm mb-4">{game.description}</p>

                {/* Характеристики */}
                <ul className="space-y-2 mb-4">
                  {game.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-500">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full"></span>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* Ціна та кнопка */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <span className="text-2xl font-bold text-[#1C3A2E]">{game.price}</span>
                  <span className="inline-flex items-center gap-2 text-[#D4A017] font-medium group-hover:gap-3 transition-all">
                    Детальніше <FaArrowRight />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Додатковий текст */}
        <div className="text-center mt-16">
          <p className="text-gray-500 text-sm">
            Більше ігор з'явиться найближчим часом
          </p>
        </div>
      </div>
    </main>
  );
}