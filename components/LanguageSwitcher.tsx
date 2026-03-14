'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LanguageSwitcher() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState('uk');

  const languages = [
    { code: 'uk', name: 'Українська' },
    { code: 'en', name: 'English' },
    { code: 'pl', name: 'Polski' },
  ];

  const switchLanguage = (code: string) => {
    setCurrentLang(code);
    setIsOpen(false);
    document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=31536000`;
    router.refresh(); // перезавантажує сторінку з новою мовою
  };

  const current = languages.find(lang => lang.code === currentLang);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-[120px] px-3 py-2 rounded-lg hover:bg-gray-100 transition text-[#1C3A2E] text-left"
      >
        {current?.name}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[120px] bg-white rounded-lg shadow-lg py-1 z-50">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => switchLanguage(lang.code)}
              className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${
                currentLang === lang.code ? 'bg-gray-50 text-[#D4A017] font-medium' : 'text-gray-700'
              }`}
            >
              {lang.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}