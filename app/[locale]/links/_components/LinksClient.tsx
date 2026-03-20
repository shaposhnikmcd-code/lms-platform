'use client';

import { Link } from '@/i18n/navigation';
import { useState } from 'react';
import Image from 'next/image';
import { FaTelegram, FaYoutube, FaInstagram, FaEnvelope, FaStar, FaShareAlt } from 'react-icons/fa';

interface LinkItem { title: string; href: string; external?: boolean; }
interface Props { content: { title: string; qrTitle: string; qrClose: string; links: LinkItem[]; footer: { join: string; cookies: string; report: string; privacy: string; explore: string; }; }; }

export default function LinksClient({ content }: Props) {
  const [showQR, setShowQR] = useState(false);
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b3d2e] to-[#022d23] p-4">
      <div className="container mx-auto max-w-md">
        <div className="bg-[#003d30] rounded-[32px] p-8 md:p-10 shadow-2xl relative">
          <button className="absolute top-6 left-6 w-10 h-10 bg-[#d9d9d9] rounded-full flex items-center justify-center hover:opacity-80 transition-all"><FaStar className="text-[#003d30] text-lg" /></button>
          <button onClick={() => setShowQR(!showQR)} className="absolute top-6 right-6 w-10 h-10 bg-[#d9d9d9] rounded-full flex items-center justify-center hover:opacity-80 transition-all"><FaShareAlt className="text-[#003d30] text-lg" /></button>
          {showQR && (
            <div className="absolute top-20 right-6 bg-white p-4 rounded-lg text-center z-10 shadow-xl w-48">
              <h3 className="text-[#003d30] font-bold mb-3 text-sm">{content.qrTitle}</h3>
              <button onClick={() => setShowQR(false)} className="text-[#003d30] underline text-xs">{content.qrClose}</button>
            </div>
          )}
          <div className="flex flex-col items-center justify-center mt-4">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-lg overflow-hidden">
              <div className="relative w-16 h-16"><Image src="/logo-white.webp" alt="UIMP" fill className="object-contain" /></div>
            </div>
            <h1 className="text-[#e7e2c6] text-2xl md:text-3xl font-bold text-center mb-8">{content.title}</h1>
            <div className="flex justify-center gap-6 mb-8">
              <a href="https://t.me/shaposhnykpsy" target="_blank" rel="noopener noreferrer" className="text-[#e7e2c6] hover:text-white transition-colors"><FaTelegram size={28} /></a>
              <a href="https://www.youtube.com/@bible_psychotherapy" target="_blank" rel="noopener noreferrer" className="text-[#e7e2c6] hover:text-white transition-colors"><FaYoutube size={28} /></a>
              <a href="https://www.instagram.com/uimp_psychotherapy" target="_blank" rel="noopener noreferrer" className="text-[#e7e2c6] hover:text-white transition-colors"><FaInstagram size={28} /></a>
              <a href="mailto:info@uimp.ua" className="text-[#e7e2c6] hover:text-white transition-colors"><FaEnvelope size={28} /></a>
            </div>
            <div className="w-full space-y-2 mt-4">
              {content.links.map((link, index) => {
                if (link.external) {
                  return (
                    <a key={index} href={link.href} target="_blank" rel="noopener noreferrer" className="block bg-[#e7e2c6] hover:bg-white transition-colors px-4 py-3 text-center rounded-lg w-full">
                      <span className="text-[#003d30] text-sm font-medium">{link.title}</span>
                    </a>
                  );
                }
                return (
                  <Link key={index} href={link.href} className="block bg-[#e7e2c6] hover:bg-white transition-colors px-4 py-3 text-center rounded-lg w-full">
                    <span className="text-[#003d30] text-sm font-medium">{link.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mt-6 text-center">
          <p className="text-white/40 text-xs">{content.footer.join}</p>
          <div className="flex justify-center gap-2 mt-2 text-white/30 text-xs">
            <button className="hover:text-white/60 transition-colors">{content.footer.cookies}</button>
            <span>{'\u2022'}</span>
            <button className="hover:text-white/60 transition-colors">{content.footer.report}</button>
            <span>{'\u2022'}</span>
            <button className="hover:text-white/60 transition-colors">{content.footer.privacy}</button>
            <span>{'\u2022'}</span>
            <button className="hover:text-white/60 transition-colors">{content.footer.explore}</button>
          </div>
        </div>
      </div>
    </div>
  );
}