export const dynamic = 'force-dynamic';

import { Link } from '@/i18n/navigation';

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[#1C3A2E] mb-3">{"Оплата успішна!"}</h1>
        <p className="text-gray-500 mb-2">{"Дякуємо за замовлення гри Конектор."}</p>
        <p className="text-gray-500 mb-8">{"Ми зв'яжемося з вами найближчим часом для підтвердження доставки."}</p>
        <Link href="/" className="inline-block bg-[#D4A017] text-white font-bold py-3 px-8 rounded-xl hover:bg-[#b88913] transition-colors">
          {"На головну"}
        </Link>
      </div>
    </div>
  );
}