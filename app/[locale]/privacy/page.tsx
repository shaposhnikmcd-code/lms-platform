import { getTranslatedContent } from '@/lib/translate';
import { privacyContent } from './_content/uk';

const getContent = getTranslatedContent(privacyContent, 'privacy-page', {
  en: () => import('./_content/en').then(m => m.default),
  pl: () => import('./_content/pl').then(m => m.default),
});

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);

  return (
    <main className="min-h-screen bg-gray-50 py-16">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-[#1C3A2E] mb-2">{c.title}</h1>
        <p className="text-gray-400 text-sm mb-10">{c.lastUpdated}</p>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-8 text-gray-700 text-sm leading-relaxed">
          {c.sections.map((section, i) => (
            <section key={i}>
              <h2 className="text-lg font-bold text-[#1C3A2E] mb-3">{section.title}</h2>

              {'paragraphs' in section && section.paragraphs?.map((p, j) => (
                <p key={j} className={j > 0 ? 'mt-2' : ''}>{p}</p>
              ))}

              {'intro' in section && section.intro && (
                <p>{section.intro}</p>
              )}

              {'items' in section && section.items && (
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  {section.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              )}

              {'outro' in section && section.outro && (
                <p className="mt-2">{section.outro}</p>
              )}

              {'email' in section && section.email && (
                <p className="mt-1">
                  {"Email: "}
                  <a href={`mailto:${section.email}`} className="text-[#D4A843] hover:underline">
                    {section.email}
                  </a>
                </p>
              )}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}