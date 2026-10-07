import { getTranslatedContent } from '@/lib/translate';
import { buildPageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import { offerContent } from './_content/uk';

const getContent = getTranslatedContent(offerContent, 'offer-page', {
  en: () => import('./_content/en').then(m => m.default),
  pl: () => import('./_content/pl').then(m => m.default),
});

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const c = await getContent(locale);
  return buildPageMetadata({ locale, path: "/offer", title: c.title, description: `${c.title} — ${c.subtitle}` });
}

export default async function OfferPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);

  return (
    <main className="min-h-screen bg-gray-50 py-16">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-[#1C3A2E] mb-2">{c.title}</h1>
        <p className="text-gray-400 text-sm mb-10">{c.placeDate}</p>

        {c.languageNote && (
          <p lang={locale} className="mb-6 rounded-xl border border-[#D4A843]/40 bg-[#D4A843]/10 px-4 py-3 text-sm text-[#1C3A2E]">
            {c.languageNote}
          </p>
        )}

        <div lang="uk" className="bg-white rounded-2xl shadow-sm p-8 space-y-8 text-gray-700 text-sm leading-relaxed">
          <header className="text-center">
            <p className="text-lg font-bold text-[#1C3A2E] tracking-wide">{c.documentTitle}</p>
            <p className="mt-1">{c.subtitle}</p>
            <p className="mt-1 font-semibold text-[#1C3A2E]">{c.organization}</p>
          </header>

          <p>{c.intro}</p>

          {c.sections.map((section, i) => (
            <section key={i}>
              <h2 className="text-lg font-bold text-[#1C3A2E] mb-3">{section.title}</h2>
              <div className="space-y-2">
                {section.points.map((point) => (
                  <div key={point.n}>
                    <p>
                      <span className="font-semibold text-[#1C3A2E]">{point.n}</span>{' '}{point.text}
                    </p>
                    {point.bullets && (
                      <ul className="list-disc pl-10 space-y-1 mt-1">
                        {point.bullets.map((b, j) => (
                          <li key={j}>{b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
