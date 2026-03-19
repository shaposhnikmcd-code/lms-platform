import Link from 'next/link';
import Image from 'next/image';
import { FaArrowRight } from 'react-icons/fa';
import { Inter } from 'next/font/google';
import { getTranslatedContent } from '@/lib/translate';
import { gamesContent } from './_content/uk';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });
const getContent = getTranslatedContent(gamesContent, 'games-page');

export default async function GamesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);

  return (
    <main className={`min-h-screen bg-gradient-to-b from-[#FDF2EB] to-white ${inter.className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">

        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-[#1C3A2E] mb-4">{c.title}</h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">{c.subtitle}</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {c.games.map((game, i) => (
            <Link key={i} href={game.href}
              className="group bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
              <div className="relative h-64 w-full overflow-hidden">
                <Image src={game.image} alt={game.title} fill
                  className="object-cover group-hover:scale-110 transition-transform duration-500" />
              </div>
              <div className="p-6">
                <h2 className="text-2xl font-bold text-[#1C3A2E] mb-2">{game.title}</h2>
                <p className="text-gray-600 text-sm mb-4">{game.description}</p>
                <ul className="space-y-2 mb-4">
                  {game.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-gray-500">
                      <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full"></span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <span className="text-2xl font-bold text-[#1C3A2E]">{game.price}</span>
                  <span className="inline-flex items-center gap-2 text-[#D4A017] font-medium group-hover:gap-3 transition-all">
                    {c.detailsBtn} <FaArrowRight />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center mt-16">
          <p className="text-gray-500 text-sm">{c.soon}</p>
        </div>
      </div>
    </main>
  );
}