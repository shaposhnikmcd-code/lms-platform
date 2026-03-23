'use client';

import { useState } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import FlagImg from './FlagImg';
import { ALL_COUNTRIES, COUNTRY_PHONE } from '../_constants/countries';

interface Props {
  label: string;
  phoneCountry: string;
  phone: string;
  onPhoneCountryChange: (code: string) => void;
  onPhoneChange: (value: string) => void;
}

export default function PhoneInput({ label, phoneCountry, phone, onPhoneCountryChange, onPhoneChange }: Props) {
  const [showDropdown, setShowDropdown] = useState(false);
  const phoneInfo = COUNTRY_PHONE[phoneCountry] ?? COUNTRY_PHONE['UA'];

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} <span className="text-red-500">{"*"}</span>
      </label>
      <div className="flex">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDropdown(prev => !prev)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            className="flex items-center gap-2 px-3 py-3 border border-r-0 border-gray-200 rounded-l-lg bg-gray-50 hover:bg-gray-100 transition-colors h-full"
          >
            <FlagImg code={phoneCountry} />
            <span className="text-sm font-medium text-gray-700">{phoneInfo.prefix}</span>
            <FaChevronDown className="text-gray-400" size={10} />
          </button>
          {showDropdown && (
            <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto min-w-max">
              {ALL_COUNTRIES.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onMouseDown={() => { onPhoneCountryChange(c.code); setShowDropdown(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-sm"
                >
                  <FlagImg code={c.code} />
                  <span className="font-medium text-gray-700">{COUNTRY_PHONE[c.code]?.prefix}</span>
                  <span className="text-gray-500">{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          type="tel"
          name="phone"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          required
          className="block w-full px-3 py-3 border border-gray-200 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent"
          placeholder={phoneInfo.placeholder}
        />
      </div>
    </div>
  );
}