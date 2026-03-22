'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState({
    necessary: true,
    performance: false,
    functional: false,
    advertising: false
  });
  const t = useTranslations('CookieBanner');

  useEffect(() => {
    const saved = localStorage.getItem('cookiePreferences');
    if (!saved) {
      setShowBanner(true);
    } else {
      setPreferences(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    const handleOpenSettings = () => {
      setShowSettings(true);
      setShowBanner(false);
    };
    window.addEventListener('openCookieSettings', handleOpenSettings);
    return () => window.removeEventListener('openCookieSettings', handleOpenSettings);
  }, []);

  const handleAcceptAll = () => {
    const allAccepted = { necessary: true, performance: true, functional: true, advertising: true };
    setPreferences(allAccepted);
    localStorage.setItem('cookiePreferences', JSON.stringify(allAccepted));
    setShowBanner(false);
    setShowSettings(false);
  };

  const handleSavePreferences = () => {
    localStorage.setItem('cookiePreferences', JSON.stringify(preferences));
    setShowBanner(false);
    setShowSettings(false);
  };

  const handleRejectAll = () => {
    const onlyNecessary = { necessary: true, performance: false, functional: false, advertising: false };
    setPreferences(onlyNecessary);
    localStorage.setItem('cookiePreferences', JSON.stringify(onlyNecessary));
    setShowBanner(false);
    setShowSettings(false);
  };

  if (!showBanner && !showSettings) return null;

  return (
    <>
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40" />
      )}

      <div className={`fixed ${showSettings ? 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md px-4' : 'bottom-0 left-0 right-0 z-50'}`}>
        <div className={`bg-white ${showSettings ? 'rounded-lg shadow-xl' : 'border-t border-gray-200'}`}>
          <div className="p-6">
            <h2 className="text-xl font-bold text-[#1C3A2E] mb-3">{t('title')}</h2>

            <p className="text-sm text-gray-600 mb-6">
              {t('description')}{" "}
              <Link href="/privacy" className="underline text-[#1C3A2E]">{t('privacyLink')}</Link>
              {"."}
            </p>

            {showSettings && (
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-semibold text-sm">{t('necessary')}</span>
                  <span className="text-xs bg-gray-100 px-3 py-1 rounded">{t('alwaysOn')}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-semibold text-sm">{t('performance')}</span>
                  <button
                    onClick={() => setPreferences(prev => ({ ...prev, performance: !prev.performance }))}
                    className={`w-12 h-6 rounded-full transition-colors ${preferences.performance ? 'bg-[#1C3A2E]' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transform transition-transform ${preferences.performance ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-semibold text-sm">{t('functional')}</span>
                  <button
                    onClick={() => setPreferences(prev => ({ ...prev, functional: !prev.functional }))}
                    className={`w-12 h-6 rounded-full transition-colors ${preferences.functional ? 'bg-[#1C3A2E]' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transform transition-transform ${preferences.functional ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-semibold text-sm">{t('advertising')}</span>
                  <button
                    onClick={() => setPreferences(prev => ({ ...prev, advertising: !prev.advertising }))}
                    className={`w-12 h-6 rounded-full transition-colors ${preferences.advertising ? 'bg-[#1C3A2E]' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transform transition-transform ${preferences.advertising ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {!showSettings ? (
                <>
                  <button onClick={handleAcceptAll} className="w-full bg-[#1C3A2E] text-white py-3 rounded-lg font-semibold hover:bg-opacity-90 transition-all">
                    {t('acceptAll')}
                  </button>
                  <button onClick={() => setShowSettings(true)} className="w-full border border-[#1C3A2E] text-[#1C3A2E] py-3 rounded-lg font-semibold hover:bg-gray-50 transition-all">
                    {t('customize')}
                  </button>
                  <button onClick={handleRejectAll} className="w-full text-gray-500 py-2 text-sm hover:underline">
                    {t('rejectAll')}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={handleSavePreferences} className="w-full bg-[#1C3A2E] text-white py-3 rounded-lg font-semibold hover:bg-opacity-90 transition-all">
                    {t('savePreferences')}
                  </button>
                  <button onClick={() => setShowSettings(false)} className="w-full text-gray-500 py-2 text-sm hover:underline">
                    {t('cancel')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}