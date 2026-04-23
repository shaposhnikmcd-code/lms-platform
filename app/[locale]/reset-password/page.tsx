'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';

type TokenState =
  | { status: 'checking' }
  | { status: 'invalid' }
  | { status: 'valid'; purpose: 'INVITE' | 'RESET' };

function ResetPasswordInner() {
  const t = useTranslations('ResetPassword');
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [tokenState, setTokenState] = useState<TokenState>({ status: 'checking' });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenState({ status: 'invalid' });
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (data.valid) {
          setTokenState({ status: 'valid', purpose: data.purpose });
        } else {
          setTokenState({ status: 'invalid' });
        }
      } catch {
        setTokenState({ status: 'invalid' });
      }
    })();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError(t('passwordTooShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('passwordsMismatch'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t('errorGeneric'));
        setLoading(false);
        return;
      }
      setSuccess(true);
      // Якщо юзер ввів свій email — спробуємо одразу залогінити. Інакше редіректимо на login.
      if (email.trim()) {
        await signIn('credentials', { email: email.trim(), password, callbackUrl: '/dashboard', redirect: true });
      } else {
        setTimeout(() => router.replace('/login'), 1200);
      }
    } catch {
      setError(t('errorGeneric'));
      setLoading(false);
    }
  };

  if (tokenState.status === 'checking') {
    return (
      <Center>
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-stone-300 border-t-[#D4A017]" />
      </Center>
    );
  }

  if (tokenState.status === 'invalid') {
    return (
      <Center>
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-[#1C3A2E] mb-2">{t('invalidTitle')}</h1>
          <p className="text-sm text-gray-600 mb-6">{t('invalidMessage')}</p>
          <Link
            href="/forgot-password"
            className="inline-block px-6 py-3 bg-[#D4A017] text-white font-semibold rounded-xl hover:bg-[#b88913]"
          >
            {t('requestNew')}
          </Link>
        </div>
      </Center>
    );
  }

  const isInvite = tokenState.purpose === 'INVITE';

  return (
    <Center>
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-[#1C3A2E] mb-2">
          {isInvite ? t('inviteTitle') : t('resetTitle')}
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          {isInvite ? t('inviteSubtitle') : t('resetSubtitle')}
        </p>

        {success && !email.trim() ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-emerald-900">{t('successMessage')}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email-hint" className="block text-sm font-medium text-gray-700 mb-1">
                {t('emailLabel')} <span className="text-gray-400 font-normal">({t('emailOptional')})</span>
              </label>
              <input
                id="email-hint"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                disabled={loading}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4A017] disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-gray-500">{t('emailHint')}</p>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                {t('newPasswordLabel')}
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4A017] disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-gray-500">{t('passwordHint')}</p>
            </div>

            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">
                {t('confirmLabel')}
              </label>
              <input
                id="confirm"
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4A017] disabled:opacity-50"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#D4A017] text-white font-semibold rounded-xl hover:bg-[#b88913] transition-all disabled:opacity-50"
            >
              {loading ? t('saving') : (isInvite ? t('submitInvite') : t('submitReset'))}
            </button>
          </form>
        )}
      </div>
    </Center>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      {children}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Center><div className="animate-spin rounded-full h-10 w-10 border-2 border-stone-300 border-t-[#D4A017]" /></Center>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
