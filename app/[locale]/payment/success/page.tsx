import { Link } from '@/i18n/navigation';
import AutoRedirect from './_components/AutoRedirect';

interface Props {
  searchParams: Promise<{ type?: string }>;
}

export default async function PaymentSuccessPage({ searchParams }: Props) {
  const { type } = await searchParams;
  const isConnector = type === 'connector';
  const isBundle = type === 'bundle';
  const isCourseLike = type === 'course' || isBundle;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <AutoRedirect type={type} />
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[#1C3A2E] mb-3">Оплата успішна!</h1>
        {isCourseLike ? (
          <>
            <p className="text-gray-500 mb-2">
              Дякуємо за придбання {isBundle ? 'пакету курсів' : 'курсу'}!
            </p>
            <p className="text-gray-500 mb-6">
              Зачекайте, ми переадресуємо вас на сторінку з інструкціями…
            </p>
          </>
        ) : isConnector ? (
          <>
            <p className="text-gray-500 mb-2">Дякуємо за замовлення гри Конектор.</p>
            <p className="text-gray-500 mb-6">
              Зачекайте, ми переадресуємо вас на сторінку з деталями…
            </p>
          </>
        ) : (
          <p className="text-gray-500 mb-6">
            Зачекайте, ми переадресуємо вас на сторінку подяки…
          </p>
        )}
        <div className="flex justify-center mb-6">
          <div className="w-6 h-6 border-2 border-[#D4A017] border-t-transparent rounded-full animate-spin" />
        </div>
        <Link
          href={`/payment/thank-you${type ? `?type=${type}` : ''}`}
          className="inline-block bg-[#D4A017] text-white font-bold py-3 px-8 rounded-xl hover:bg-[#b88913] transition-colors"
        >
          Перейти зараз
        </Link>
      </div>
    </div>
  );
}
