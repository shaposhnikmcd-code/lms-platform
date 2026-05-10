import { Link } from '@/i18n/navigation';
import { resolvePaymentByOrderRef } from '@/lib/paymentStatus';

const SENDPULSE_LOGIN_URL = 'https://uimp-edu.sendpulse.online/courses/auth/login';

interface Props {
  searchParams: Promise<{ type?: string; orderRef?: string }>;
}

export default async function ThankYouPage({ searchParams }: Props) {
  const { type, orderRef } = await searchParams;
  const isConnector = type === 'connector';
  const isBundle = type === 'bundle';

  // Defensive verification: if user lands here with an orderRef of a FAILED payment
  // (e.g. shared link, navigation glitch), show failure UI instead of fake success.
  // No orderRef → legacy/unknown flow → show success messaging as before.
  if (orderRef) {
    const { resolution } = await resolvePaymentByOrderRef(orderRef);
    if (resolution === 'FAILED') {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
          <div className="bg-white rounded-2xl shadow-lg p-10 max-w-xl w-full text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-[#1C3A2E] mb-4">Платіж не пройшов</h1>
            <p className="text-gray-700 mb-3">Банк відхилив операцію. Кошти не списано.</p>
            <p className="text-gray-600 mb-8">Спробуйте ще раз або скористайтеся іншою карткою.</p>
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
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
          <meta httpEquiv="refresh" content="3" />
          <div className="bg-white rounded-2xl shadow-lg p-10 max-w-xl w-full text-center">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <div className="w-10 h-10 border-2 border-[#D4A017] border-t-transparent rounded-full animate-spin" />
            </div>
            <h1 className="text-3xl font-bold text-[#1C3A2E] mb-4">Обробляємо платіж</h1>
            <p className="text-gray-700 mb-3">Банк підтверджує операцію. Зазвичай це триває кілька секунд.</p>
            <p className="text-gray-600">Сторінка оновиться автоматично.</p>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-xl w-full text-center">
        <div className="w-20 h-20 bg-[#D4A017]/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-[#D4A017]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-[#1C3A2E] mb-4">Дякуємо за покупку!</h1>

        {isConnector ? (
          <>
            <p className="text-gray-700 mb-3">Дякуємо за замовлення гри «Конектор».</p>
            <p className="text-gray-600 mb-8">
              {"Ми зв'яжемося з вами найближчим часом для підтвердження доставки."}
            </p>
            <Link
              href="/"
              className="inline-block bg-[#D4A017] text-white font-bold py-3 px-8 rounded-xl hover:bg-[#b88913] transition-colors"
            >
              На головну
            </Link>
          </>
        ) : (
          <>
            <p className="text-gray-700 mb-3">
              На вашу електронну пошту надіслано лист з паролем від навчальної платформи{' '}
              <span className="font-semibold text-[#1C3A2E]">SendPulse</span>.
            </p>
            <p className="text-gray-600 mb-2">
              Перевірте папку «Вхідні» — а також «Спам», якщо листа не видно протягом кількох хвилин.
            </p>
            <p className="text-gray-600 mb-6">
              Для входу на платформу та доступу до {isBundle ? 'курсів вашого пакету' : 'курсу'}{' '}
              перейдіть за посиланням нижче.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 text-left">
              <p className="text-sm text-amber-900 font-semibold mb-1.5 flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Якщо при вході SendPulse покаже «не оплачено»
              </p>
              <p className="text-sm text-amber-800 leading-relaxed">
                Зачекайте 1-2 хвилини й оновіть сторінку (Ctrl+F5). Доступ до {isBundle ? 'курсів' : 'курсу'} синхронізується протягом кількох хвилин після оплати — це нормально.
              </p>
            </div>

            <a
              href={SENDPULSE_LOGIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#D4A017] text-white font-bold py-3 px-8 rounded-xl hover:bg-[#b88913] transition-colors mb-6"
            >
              Перейти на платформу SendPulse
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </a>

            <div className="text-xs text-gray-400 mb-6 break-all">
              {SENDPULSE_LOGIN_URL}
            </div>

            <div>
              <Link href="/" className="text-sm text-gray-500 hover:text-[#1C3A2E] underline">
                На головну
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
