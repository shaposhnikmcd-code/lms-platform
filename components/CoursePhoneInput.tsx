'use client';

import { useState } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import FlagImg from './connector/_components/FlagImg';

const COUNTRIES = [
  { code: 'UA', name: 'Україна' },
  { code: 'PL', name: 'Польща' },
  { code: 'AT', name: 'Австрія' },
  { code: 'BE', name: 'Бельгія' },
  { code: 'GB', name: 'Велика Британія' },
  { code: 'GR', name: 'Греція' },
  { code: 'DK', name: 'Данія' },
  { code: 'EE', name: 'Естонія' },
  { code: 'IL', name: 'Ізраїль' },
  { code: 'IE', name: 'Ірландія' },
  { code: 'ES', name: 'Іспанія' },
  { code: 'IT', name: 'Італія' },
  { code: 'CA', name: 'Канада' },
  { code: 'LV', name: 'Латвія' },
  { code: 'LT', name: 'Литва' },
  { code: 'MD', name: 'Молдова' },
  { code: 'NL', name: 'Нідерланди' },
  { code: 'DE', name: 'Німеччина' },
  { code: 'NO', name: 'Норвегія' },
  { code: 'PT', name: 'Португалія' },
  { code: 'RO', name: 'Румунія' },
  { code: 'SK', name: 'Словаччина' },
  { code: 'US', name: 'США' },
  { code: 'HU', name: 'Угорщина' },
  { code: 'FI', name: 'Фінляндія' },
  { code: 'FR', name: 'Франція' },
  { code: 'CZ', name: 'Чехія' },
  { code: 'CH', name: 'Швейцарія' },
  { code: 'SE', name: 'Швеція' },
];

export const PHONE_CONFIG: Record<string, { prefix: string; placeholder: string; maxDigits: number }> = {
  UA: { prefix: '+380', placeholder: '(__) ___-__-__', maxDigits: 9 },
  PL: { prefix: '+48',  placeholder: '___ ___ ___',    maxDigits: 9 },
  DE: { prefix: '+49',  placeholder: '___ ________',   maxDigits: 11 },
  CZ: { prefix: '+420', placeholder: '___ ___ ___',    maxDigits: 9 },
  CA: { prefix: '+1',   placeholder: '(___) ___-____', maxDigits: 10 },
  US: { prefix: '+1',   placeholder: '(___) ___-____', maxDigits: 10 },
  GB: { prefix: '+44',  placeholder: '____ ______',    maxDigits: 10 },
  IL: { prefix: '+972', placeholder: '__ ___ ____',    maxDigits: 9 },
  IT: { prefix: '+39',  placeholder: '___ ___ ____',   maxDigits: 10 },
  ES: { prefix: '+34',  placeholder: '___ ___ ___',    maxDigits: 9 },
  PT: { prefix: '+351', placeholder: '___ ___ ___',    maxDigits: 9 },
  FR: { prefix: '+33',  placeholder: '_ __ __ __ __',  maxDigits: 9 },
  IE: { prefix: '+353', placeholder: '__ ___ ____',    maxDigits: 9 },
  NL: { prefix: '+31',  placeholder: '___ _______',    maxDigits: 9 },
  BE: { prefix: '+32',  placeholder: '___ __ __ __',   maxDigits: 9 },
  AT: { prefix: '+43',  placeholder: '___ _______',    maxDigits: 10 },
  CH: { prefix: '+41',  placeholder: '__ ___ __ __',   maxDigits: 9 },
  SE: { prefix: '+46',  placeholder: '__ ___ __ __',   maxDigits: 9 },
  NO: { prefix: '+47',  placeholder: '___ __ ___',     maxDigits: 8 },
  DK: { prefix: '+45',  placeholder: '__ __ __ __',    maxDigits: 8 },
  FI: { prefix: '+358', placeholder: '__ ___ ____',    maxDigits: 10 },
  LT: { prefix: '+370', placeholder: '___ _____',      maxDigits: 8 },
  LV: { prefix: '+371', placeholder: '____ ____',      maxDigits: 8 },
  EE: { prefix: '+372', placeholder: '___ ____',       maxDigits: 8 },
  SK: { prefix: '+421', placeholder: '___ ___ ___',    maxDigits: 9 },
  HU: { prefix: '+36',  placeholder: '___ ___ ____',   maxDigits: 9 },
  RO: { prefix: '+40',  placeholder: '___ ___ ___',    maxDigits: 9 },
  MD: { prefix: '+373', placeholder: '___ _____',      maxDigits: 8 },
  GR: { prefix: '+30',  placeholder: '___ ___ ____',   maxDigits: 10 },
};

interface Props {
  phoneCountry: string;
  phone: string;
  onPhoneCountryChange: (code: string) => void;
  onPhoneChange: (value: string) => void;
}

export default function CoursePhoneInput({ phoneCountry, phone, onPhoneCountryChange, onPhoneChange }: Props) {
  const [showDropdown, setShowDropdown] = useState(false);
  const phoneInfo = PHONE_CONFIG[phoneCountry] ?? PHONE_CONFIG['UA'];

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Телефон <span className="text-red-500">*</span>
      </label>
      <div className="flex">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDropdown(prev => !prev)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            className="flex items-center gap-2 px-3 py-3 border border-r-0 border-gray-300 rounded-l-lg bg-gray-50 hover:bg-gray-100 transition-colors h-full"
          >
            <FlagImg code={phoneCountry} />
            <span className="text-sm font-medium text-gray-700">{phoneInfo.prefix}</span>
            <FaChevronDown className="text-gray-400" size={10} />
          </button>
          {showDropdown && (
            <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto min-w-max">
              {COUNTRIES.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onMouseDown={() => { onPhoneCountryChange(c.code); setShowDropdown(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-sm"
                >
                  <FlagImg code={c.code} />
                  <span className="font-medium text-gray-700">{PHONE_CONFIG[c.code]?.prefix}</span>
                  <span className="text-gray-500">{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          type="tel"
          value={phone}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '');
            const max = phoneInfo.maxDigits ?? 12;
            if (digits.length <= max) {
              onPhoneChange(digits);
            }
          }}
          maxLength={phoneInfo.maxDigits ?? 12}
          required
          className="block w-full px-3 py-3 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent"
          placeholder={phoneInfo.placeholder}
        />
      </div>
    </div>
  );
}
