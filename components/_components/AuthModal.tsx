'use client';

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { FaFacebook, FaEnvelope, FaTimes } from 'react-icons/fa';
import { useTranslations } from 'next-intl';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [emailMode, setEmailMode] = useState(false);
  const [registerMode, setRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const t = useTranslations('Auth');

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const closeModal = () => {
    onClose();
    setEmailMode(false);
    setRegisterMode(false);
    setEmail('');
    setPassword('');
    setName('');
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!email || !password) { alert(t('fillFields')); return; }
    setLoading(true);
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (!response.ok) { alert(data.error || t('registerError')); setLoading(false); return; }
      await signIn('credentials', { email, password, callbackUrl: '/', redirect: true });
      closeModal();
    } catch { alert(t('registerFail')); setLoading(false); }
  };

  const handleLogin = async () => {
    if (!email || !password) { alert(t('fillFields')); return; }
    setLoading(true);
    try {
      await signIn('credentials', { email, password, callbackUrl: '/', redirect: true });
    } catch { alert(t('loginFail')); setLoading(false); }
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={closeModal} style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      }} />

      <div onClick={(e) => e.stopPropagation()} style={{
        position: 'relative', backgroundColor: 'white',
        borderRadius: 16, boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
        width: '100%', maxWidth: 448, margin: '0 16px', zIndex: 1,
      }}>
        <div style={{ padding: 32 }}>
          <button onClick={closeModal} style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af',
          }}>
            <FaTimes size={20} />
          </button>

          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1C3A2E', marginBottom: 8 }}>
            {registerMode ? t('registerTitle') : t('loginTitle')}
          </h2>
          <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>
            {registerMode ? t('registerSubtitle') : t('loginSubtitle')}
          </p>

          {!emailMode ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button
                  onClick={() => signIn('google', { callbackUrl: '/' })}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-white border border-[#dadce0] hover:bg-[#f8f9fa] text-[#3c4043] font-medium py-3 px-4 rounded-xl transition-all disabled:opacity-50"
                  style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                >
                  <svg width="20" height="20" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  <span>{t('google')}</span>
                </button>

                <button
                  onClick={() => signIn('facebook', { callbackUrl: '/' })}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-[#1877F2] text-white font-medium py-3 px-4 rounded-xl hover:bg-[#1669d9] transition-all disabled:opacity-50"
                >
                  <FaFacebook className="text-xl" />
                  <span>{t('facebook')}</span>
                </button>
              </div>

              <div style={{ position: 'relative', margin: '24px 0' }}>
                <div style={{ borderTop: '1px solid #e5e7eb' }} />
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', backgroundColor: 'white', padding: '0 16px' }}>
                  <span style={{ color: '#9ca3af', fontSize: 14 }}>{t('or')}</span>
                </div>
              </div>

              <button
                onClick={() => { setEmailMode(true); setRegisterMode(false); }}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-[#1C3A2E] text-white font-medium py-3 px-4 rounded-xl hover:bg-[#2a4f3f] transition-all mb-3 disabled:opacity-50"
              >
                <FaEnvelope className="text-xl" />
                <span>{t('email')}</span>
              </button>

              <button
                onClick={() => { setEmailMode(true); setRegisterMode(true); }}
                disabled={loading}
                className="w-full text-center text-[#D4A017] hover:text-[#b88913] transition-all text-sm disabled:opacity-50"
              >
                {t('noAccount')}
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {registerMode && (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4A017] disabled:opacity-50"
                  placeholder={t('namePlaceholder')}
                  disabled={loading}
                />
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4A017] disabled:opacity-50"
                placeholder="your@email.com"
                disabled={loading}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4A017] disabled:opacity-50"
                placeholder="••••••••"
                disabled={loading}
              />

              {registerMode ? (
                <button onClick={handleRegister} disabled={loading}
                  className="w-full bg-[#D4A017] text-white font-medium py-3 px-4 rounded-xl hover:bg-[#b88913] transition-all disabled:opacity-50">
                  {loading ? t('loading') : t('register')}
                </button>
              ) : (
                <button onClick={handleLogin} disabled={loading}
                  className="w-full bg-[#D4A017] text-white font-medium py-3 px-4 rounded-xl hover:bg-[#b88913] transition-all disabled:opacity-50">
                  {loading ? t('loading') : t('login')}
                </button>
              )}

              <div className="flex flex-col gap-2">
                {!registerMode && (
                  <Link href="/forgot-password"
                    className="text-center text-[#D4A017] hover:text-[#b88913] transition-all text-sm">
                    {t('forgotPassword')}
                  </Link>
                )}
                <button onClick={() => setRegisterMode(!registerMode)} disabled={loading}
                  className="text-center text-[#D4A017] hover:text-[#b88913] transition-all text-sm disabled:opacity-50">
                  {registerMode ? t('hasAccount') : t('noAccount')}
                </button>
                <button onClick={() => { setEmailMode(false); setRegisterMode(false); }} disabled={loading}
                  style={{ background: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', color: '#D4A017', fontSize: 14, opacity: loading ? 0.5 : 1 }}>
                  {t('backToSocial')}
                </button>
              </div>
            </div>
          )}

          <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 24 }}>
            {t('termsText')}{" "}
            <Link href="/terms" style={{ color: '#D4A017' }}>{t('terms')}</Link>
            {" "}{t('termsAnd')}{" "}
            <Link href="/privacy" style={{ color: '#D4A017' }}>{t('privacy')}</Link>
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}