import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo';

// Сторінка написана лише українською (вимога Meta/Google для data-deletion URL).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    path: '/delete-data',
    title: 'Видалення даних',
    description: 'Як подати запит на видалення персональних даних з платформи UIMP.',
  });
}

export default function DeleteDataPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-3xl font-bold text-[#1C3A2E] mb-8">Видалення даних</h1>
      
      <div className="space-y-6 text-gray-700">
        <p>Для видалення ваших даних, напишіть нам на email:</p>
        
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="font-semibold">Email: <a href="mailto:support@uimp.com" className="text-[#D4A017]">support@uimp.com</a></p>
        </div>

        <p className="text-sm text-gray-500">Ми видалимо ваші дані протягом 30 днів після запиту.</p>
      </div>
    </div>
  );
}