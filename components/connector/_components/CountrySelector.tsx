'use client';

import { useState } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import FlagImg from './FlagImg';
import { ALL_COUNTRIES } from '../_constants/countries';

interface Props {
  label: string;
  selectedCode: string;
  onSelect: (code: string) => void;
  /** Локалізовані назви країн. Ключ — код (UA/PL/EN), значення — назва цією мовою.
   *  Список країн беремо з ALL_COUNTRIES (канонічний deliverable-список), а тільки
   *  назви замінюємо на переклад. Якщо перекладу немає — fallback на назву з constants. */
  countries?: { code: string; name: string }[];
}

export default function CountrySelector({ label, selectedCode, onSelect, countries }: Props) {
  const [showDropdown, setShowDropdown] = useState(false);
  const nameByCode = new Map((countries ?? []).map(c => [c.code, c.name]));
  const localized = ALL_COUNTRIES.map(c => ({ code: c.code, name: nameByCode.get(c.code) ?? c.name }));
  const selected = localized.find(c => c.code === selectedCode);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} <span className="text-red-500">{"*"}</span>
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowDropdown(prev => !prev)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          className="w-full flex items-center gap-3 px-3 py-3 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
        >
          <FlagImg code={selectedCode} />
          <span className="flex-1 text-left text-sm text-gray-700">{selected?.name}</span>
          <FaChevronDown className="text-gray-400" size={12} />
        </button>
        {showDropdown && (
          <div className="absolute z-50 top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {localized.map(c => (
              <button
                key={c.code}
                type="button"
                onMouseDown={() => { onSelect(c.code); setShowDropdown(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-sm"
              >
                <FlagImg code={c.code} />
                <span className="text-gray-700">{c.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}