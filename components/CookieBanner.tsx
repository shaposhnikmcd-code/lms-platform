'use client';

import { useState, useEffect } from 'react';

export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState({
    necessary: true,
    performance: false,
    functional: false,
    advertising: false
  });

  useEffect(() => {
    // Перевіряємо чи користувач вже зберіг налаштування
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
    const allAccepted = {
      necessary: true,
      performance: true,
      functional: true,
      advertising: true
    };
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
    const onlyNecessary = {
      necessary: true,
      performance: false,
      functional: false,
      advertising: false
    };
    setPreferences(onlyNecessary);
    localStorage.setItem('cookiePreferences', JSON.stringify(onlyNecessary));
    setShowBanner(false);
    setShowSettings(false);
  };

  if (!showBanner && !showSettings) return null;

  return (
    <>
      {/* Затемнення фону коли відкриті налаштування */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40" />
      )}

      {/* Банер або налаштування */}
      <div className={`fixed ${showSettings ? 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md' : 'bottom-0 left-0 right-0 z-50'}`}>
        <div className={`bg-white ${showSettings ? 'rounded-lg shadow-xl' : 'border-t border-gray-200'}`}>
          
          {/* Кнопка вибору мови */}
          {showSettings && (
            <div className="absolute top-4 right-4">
              <select className="text-sm border rounded px-2 py-1">
                <option>English ▼</option>
                <option>Українська</option>
              </select>
            </div>
          )}

          <div className="p-6">
            <h2 className="text-xl font-bold text-[#1C3A2E] mb-3">
              We Value Your Privacy
            </h2>
            
            <p className="text-sm text-gray-600 mb-6">
              We and our vendors use cookies and similar technologies to enhance your experience, 
              analyze site traffic, personalize content, and deliver targeted advertising. We need 
              your consent to use non-essential cookies. You can choose which categories to allow 
              below. For more details, please see our Cookie Policy.
            </p>

            {/* Налаштування cookie (показуємо тільки в settings) */}
            {showSettings && (
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-semibold">Strictly Necessary Cookies</span>
                  <span className="text-sm bg-gray-100 px-3 py-1 rounded">Always On</span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-semibold">Performance Cookies</span>
                  <button
                    onClick={() => setPreferences(prev => ({ ...prev, performance: !prev.performance }))}
                    className={`w-12 h-6 rounded-full transition-colors ${preferences.performance ? 'bg-[#1C3A2E]' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transform transition-transform ${preferences.performance ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-semibold">Functional Cookies</span>
                  <button
                    onClick={() => setPreferences(prev => ({ ...prev, functional: !prev.functional }))}
                    className={`w-12 h-6 rounded-full transition-colors ${preferences.functional ? 'bg-[#1C3A2E]' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transform transition-transform ${preferences.functional ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-semibold">Advertising Cookies</span>
                  <button
                    onClick={() => setPreferences(prev => ({ ...prev, advertising: !prev.advertising }))}
                    className={`w-12 h-6 rounded-full transition-colors ${preferences.advertising ? 'bg-[#1C3A2E]' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transform transition-transform ${preferences.advertising ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            )}

            {/* Кнопки */}
            <div className="space-y-3">
              {!showSettings ? (
                // Банер внизу
                <>
                  <button
                    onClick={handleAcceptAll}
                    className="w-full bg-[#1C3A2E] text-white py-3 rounded-lg font-semibold hover:bg-opacity-90 transition-all"
                  >
                    Accept All Cookies
                  </button>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="w-full border border-[#1C3A2E] text-[#1C3A2E] py-3 rounded-lg font-semibold hover:bg-gray-50 transition-all"
                  >
                    Customize Settings
                  </button>
                  <button
                    onClick={handleRejectAll}
                    className="w-full text-gray-500 py-2 text-sm hover:underline"
                  >
                    Reject All
                  </button>
                </>
              ) : (
                // Налаштування
                <>
                  <button
                    onClick={handleSavePreferences}
                    className="w-full bg-[#1C3A2E] text-white py-3 rounded-lg font-semibold hover:bg-opacity-90 transition-all"
                  >
                    Save My Choices
                  </button>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="w-full text-gray-500 py-2 text-sm hover:underline"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>

            {/* Cookie Preferences внизу */}
            {!showSettings && (
              <div className="mt-4 text-center text-xs text-gray-400">
                <span>Cookie Preferences</span>
                <span className="mx-2">•</span>
                <span>Report</span>
                <span className="mx-2">•</span>
                <span>Privacy</span>
                <span className="mx-2">•</span>
                <span>Explore</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}