'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FaChevronDown, FaSearch } from 'react-icons/fa';
import { HiOutlineGlobeAlt } from 'react-icons/hi2';
import { COUNTRIES, getCountry } from '@/lib/countries';

/// Прапор країни за ISO 3166-1 alpha-2 кодом. flagcdn.com — стабільний публічний
/// CDN із SVG/PNG прапорами усіх країн (~70+). Використовуємо PNG @2x для retina.
function FlagImg({ code, size = 20 }: { code: string; size?: number }) {
  const lower = code.toLowerCase();
  const height = Math.round((size * 14) / 20); // ~5:3.5 співвідношення як у LanguageSwitcher
  return (
    <img
      src={`https://flagcdn.com/w40/${lower}.png`}
      srcSet={`https://flagcdn.com/w80/${lower}.png 2x`}
      width={size}
      height={height}
      alt=""
      aria-hidden
      loading="lazy"
      style={{
        borderRadius: 3,
        flexShrink: 0,
        objectFit: 'cover',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.06)',
      }}
    />
  );
}

interface Props {
  value: string;
  onChange: (code: string) => void;
  invalid?: boolean;
  placeholder?: string;
  disabled?: boolean;
  /// Override вертикального padding (Tailwind class, напр. 'py-[10px]', 'py-2').
  /// Дефолт — 'py-3'. Використовується для тонкого тюнінгу висоти у формах оплати.
  paddingY?: string;
}

/// Searchable dropdown для вибору країни проживання у формі оплати Річної програми.
/// Реюзана версія підходу з tetyana-website CountrySelector, плюс search-input
/// (потрібно для довгого списку — 70+ країн).
export default function CountryPicker({
  value,
  onChange,
  invalid = false,
  placeholder = 'Оберіть країну',
  disabled = false,
  paddingY = 'py-3',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selected = getCountry(value);

  // Закриття на клік поза списком.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Автофокус search-input при відкритті.
  useEffect(() => {
    if (open) {
      setQuery('');
      const id = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }, [query]);

  function pick(code: string) {
    onChange(code);
    setOpen(false);
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((p) => !p)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        className={`w-full flex items-center gap-3 px-4 ${paddingY} border rounded-lg outline-none transition-colors text-left ${
          invalid
            ? 'border-red-400 bg-red-50/30 focus:ring-2 focus:ring-red-300'
            : 'border-gray-300 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-[#D4A017] focus:border-transparent'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        {selected ? (
          <FlagImg code={selected.code} />
        ) : (
          <HiOutlineGlobeAlt className="text-base text-gray-400" aria-hidden />
        )}
        <span className={`flex-1 text-sm ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
          {selected ? selected.name : placeholder}
        </span>
        <FaChevronDown className={`text-gray-400 text-xs transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-[10000] top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-2xl overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <FaSearch className="text-gray-400 text-xs" aria-hidden />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Пошук країни..."
              className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder:text-gray-400"
            />
          </div>
          <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-gray-400 text-center">Нічого не знайдено</li>
            ) : (
              filtered.map((c) => {
                const isSelected = c.code === value;
                return (
                  <li key={c.code} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => pick(c.code)}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                        isSelected
                          ? 'bg-[#FDF6E0] text-[#1C3A2E] font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <FlagImg code={c.code} />
                      <span className="flex-1 text-left">{c.name}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
