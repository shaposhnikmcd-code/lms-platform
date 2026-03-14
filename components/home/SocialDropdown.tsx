'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { FaChevronDown } from 'react-icons/fa';

const TelegramIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z" fill="#26A5E4"/>
    <path d="M17.894 7.373l-2.185 10.301c-.165.737-.594.918-1.204.571l-3.33-2.452-1.607 1.547c-.178.178-.327.327-.67.327l.239-3.396 6.165-5.571c.268-.239-.058-.372-.414-.133L6.19 13.885l-3.27-1.022c-.711-.222-.726-.711.148-1.053l12.762-4.921c.593-.214 1.112.133.918 1.053l.146.43z" fill="white"/>
  </svg>
);

const InstagramIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <defs>
      <radialGradient id="ig-grad1" cx="30%" cy="107%" r="150%">
        <stop offset="0%" stopColor="#fdf497"/>
        <stop offset="5%" stopColor="#fdf497"/>
        <stop offset="45%" stopColor="#fd5949"/>
        <stop offset="60%" stopColor="#d6249f"/>
        <stop offset="90%" stopColor="#285AEB"/>
      </radialGradient>
    </defs>
    <rect width="24" height="24" rx="6" fill="url(#ig-grad1)"/>
    <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.8" fill="none"/>
    <circle cx="17.5" cy="6.5" r="1.2" fill="white"/>
  </svg>
);

const YouTubeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805z" fill="#FF0000"/>
    <path d="M9.609 15.601V8.408l6.264 3.602z" fill="white"/>
  </svg>
);

export default function SocialDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    { href: 'https://t.me/shaposhnykpsy', icon: TelegramIcon, label: 'Telegram', hover: 'hover:bg-[#26A5E4]' },
    { href: 'https://www.instagram.com/uimp_psychotherapy', icon: InstagramIcon, label: 'Instagram', hover: 'hover:bg-gradient-to-r hover:from-[#fd5949] hover:to-[#d6249f]' },
    { href: 'https://www.youtube.com/@bible_psychotherapy', icon: YouTubeIcon, label: 'YouTube', hover: 'hover:bg-[#FF0000]' },
  ];

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 bg-[#D4A017] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#b88913] transition-all"
      >
        <span>Наші соцмережі</span>
        <FaChevronDown className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-xl overflow-hidden z-50">
          {socialLinks.map((social, index) => (
            <Link
              key={index}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 px-4 py-3 text-gray-700 hover:text-white transition-all ${social.hover}`}
              onClick={() => setIsOpen(false)}
            >
              <social.icon />
              <span>{social.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}