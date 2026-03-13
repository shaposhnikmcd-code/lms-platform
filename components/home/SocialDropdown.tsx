// components/home/SocialDropdown.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { FaTelegram, FaInstagram, FaYoutube, FaChevronDown } from 'react-icons/fa';

export default function SocialDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Закриття при кліку поза меню
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const socialLinks = [
    { href: 'https://t.me/shaposhnykpsy', icon: FaTelegram, label: 'Telegram', color: 'hover:bg-[#26A5E4]' },
    { href: 'https://www.instagram.com/uimp_psychotherapy', icon: FaInstagram, label: 'Instagram', color: 'hover:bg-[#E4405F]' },
    { href: 'https://www.youtube.com/@bible_psychotherapy', icon: FaYoutube, label: 'YouTube', color: 'hover:bg-[#FF0000]' },
  ];

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Головна кнопка */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group inline-flex items-center gap-2 bg-[#D4A017] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#b88913] transition-all"
      >
        <span>Наші соцмережі</span>
        <FaChevronDown 
          className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Випадаюче меню */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-xl overflow-hidden z-50 animate-fadeIn">
          {socialLinks.map((social, index) => (
            <Link
              key={index}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 px-4 py-3 text-gray-700 hover:text-white transition-all ${social.color} group`}
              onClick={() => setIsOpen(false)}
            >
              <social.icon className="text-xl" />
              <span>{social.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}