import Link from 'next/link';

const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  AccessDenied: {
    title: 'Доступ заборонено',
    description:
      'Ваш email не має прав для входу в платформу. Доступ мають лише адміністратори та менеджери UIMP. Якщо ви вважаєте, що це помилка — зверніться до адміністратора.',
  },
  Configuration: {
    title: 'Помилка конфігурації',
    description: 'Сервер автентифікації налаштований некоректно. Зверніться до адміністратора.',
  },
  Verification: {
    title: 'Не вдалося підтвердити вхід',
    description: 'Посилання застаріло або вже було використане. Спробуйте увійти ще раз.',
  },
  OAuthSignin: {
    title: 'Помилка входу через зовнішній сервіс',
    description: 'Не вдалося розпочати вхід через Google/Facebook. Спробуйте ще раз.',
  },
  OAuthCallback: {
    title: 'Помилка відповіді від сервісу',
    description: 'Зовнішній сервіс повернув помилку. Спробуйте ще раз або скористайтесь іншим способом входу.',
  },
  OAuthAccountNotLinked: {
    title: 'Акаунт не прив\'язаний',
    description: 'Цей email вже використовувався з іншим способом входу. Увійдіть тим способом, яким реєструвалися.',
  },
  Default: {
    title: 'Сталася помилка',
    description: 'Не вдалося виконати вхід. Спробуйте ще раз.',
  },
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorKey = error && ERROR_MESSAGES[error] ? error : 'Default';
  const { title, description } = ERROR_MESSAGES[errorKey];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-amber-50/30 to-slate-100 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200/60 p-8 sm:p-10 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-8 h-8 text-amber-600"
          >
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
        </div>

        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-3">{title}</h1>
        <p className="text-slate-600 leading-relaxed mb-8">{description}</p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/uk/login"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors"
          >
            Спробувати ще раз
          </Link>
          <Link
            href="/uk"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-white text-slate-700 font-medium border border-slate-300 hover:bg-slate-50 transition-colors"
          >
            На головну
          </Link>
        </div>

        {error && error !== 'AccessDenied' && (
          <p className="mt-6 text-xs text-slate-400">
            Код помилки: <span className="font-mono">{error}</span>
          </p>
        )}
      </div>
    </div>
  );
}
