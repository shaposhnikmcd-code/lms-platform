import { Link } from '@/i18n/navigation';
import AutoRedirect from './_components/AutoRedirect';
import PurchaseTracker from './_components/PurchaseTracker';
import { resolvePaymentByOrderRef, type PaymentResolution } from '@/lib/paymentStatus';
import { buildPurchaseEvent, type GA4PurchaseEvent } from '@/lib/analytics/buildPurchaseEvent';

interface Props {
  searchParams: Promise<{ type?: string; orderRef?: string }>;
}

export default async function PaymentSuccessPage({ searchParams }: Props) {
  const { type, orderRef } = await searchParams;
  const isConnector = type === 'connector';
  const isBundle = type === 'bundle';
  const isCourseLike = type === 'course' || isBundle;

  // Verify payment status against our DB rather than trust the WFP redirect.
  // No orderRef → legacy/unknown flow → behave as before (assume success).
  let resolution: PaymentResolution = 'PAID';
  let purchaseEvent: GA4PurchaseEvent | null = null;
  if (orderRef) {
    const r = await resolvePaymentByOrderRef(orderRef);
    resolution = r.resolution === 'NOT_FOUND' ? 'PAID' : r.resolution;
    if (resolution === 'PAID') {
      try {
        purchaseEvent = await buildPurchaseEvent(orderRef);
      } catch {
        purchaseEvent = null;
      }
    }
  }

  if (resolution === 'FAILED') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#1C3A2E] mb-3">Платіж не пройшов</h1>
          <p className="text-gray-500 mb-2">
            Банк відхилив операцію. Кошти не списано.
          </p>
          <p className="text-gray-500 mb-6">
            Спробуйте ще раз або скористайтеся іншою карткою.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={isConnector ? '/links/connector' : '/courses'}
              className="inline-block bg-[#D4A017] text-white font-bold py-3 px-8 rounded-xl hover:bg-[#b88913] transition-colors"
            >
              Спробувати знову
            </Link>
            <Link
              href="/"
              className="inline-block bg-white border border-gray-200 text-gray-700 font-medium py-3 px-8 rounded-xl hover:bg-gray-50 transition-colors"
            >
              На головну
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (resolution === 'PENDING') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        {/* Page auto-refreshes every 3s so user lands on success/failed once callback arrives. */}
        <meta httpEquiv="refresh" content="3" />
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <div className="w-8 h-8 border-2 border-[#D4A017] border-t-transparent rounded-full animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-[#1C3A2E] mb-3">Обробляємо платіж</h1>
          <p className="text-gray-500 mb-6">
            Банк підтверджує операцію. Зазвичай це триває кілька секунд.
            Сторінка оновиться автоматично.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <AutoRedirect type={type} orderRef={orderRef} />
      {purchaseEvent && <PurchaseTracker event={purchaseEvent} />}
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
          href={`/payment/thank-you${type ? `?type=${type}` : ''}${orderRef ? `${type ? '&' : '?'}orderRef=${encodeURIComponent(orderRef)}` : ''}`}
          className="inline-block bg-[#D4A017] text-white font-bold py-3 px-8 rounded-xl hover:bg-[#b88913] transition-colors"
        >
          Перейти зараз
        </Link>
      </div>
    </div>
  );
}
