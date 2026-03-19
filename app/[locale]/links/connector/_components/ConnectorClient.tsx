'use client';

import Link from 'next/link';
import { FaTelegram, FaYoutube, FaInstagram } from 'react-icons/fa';
import { IoMdShare } from 'react-icons/io';
import { IoArrowBack } from 'react-icons/io5';
import Image from 'next/image';
import { useState } from 'react';
import OrderForm from '@/components/connector/OrderForm';

interface FormLabels {
  title: string;
  subtitle: string;
  emailLabel: string;
  nameLabel: string;
  namePlaceholder: string;
  phoneLabel: string;
  phonePlaceholder: string;
  countryLabel: string;
  callMe: string;
  btnSubmit: string;
  btnLoading: string;
  errorMsg: string;
  agree: string;
  cityLabel: string;
  cityPlaceholder: string;
  cityPlaceholderEu: string;
  branchLabel: string;
  branchLabelEu: string;
  branchPlaceholder: string;
  branchPlaceholderEu: string;
  branchSelectCity: string;
  notFound: string;
  deliveryTitle: string;
  deliveryText: string;
  deliveryContact: string;
  countries: { code: string; name: string }[];
}

interface Props {
  content: {
    title: string;
    subtitle: string;
    setTitle: string;
    cards: { count: string; label: string }[];
    totalCards: string;
    desc1: string;
    desc2: string;
    quote: string;
    price: string;
    delivery: string;
    btnOrder: string;
    form: FormLabels;
  };
  currency: string;
}

export default function ConnectorClient({ content, currency }: Props) {
  const [showOrderForm, setShowOrderForm] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0c4a3a] to-[#06382d] p-6">
      <div className="container mx-auto max-w-[500px]">
        <div className="bg-[#003d30] rounded-[32px] p-5 md:p-6 shadow-2xl relative">

          <Link href="/links"
            className="absolute top-4 left-4 w-[38px] h-[38px] bg-[#E0E0E0] rounded-full flex items-center justify-center hover:opacity-80 transition-all z-10">
            <IoArrowBack className="text-[#003d30] text-lg" />
          </Link>

          <button className="absolute top-4 right-4 w-[38px] h-[38px] bg-[#E0E0E0] rounded-full flex items-center justify-center hover:opacity-80 transition-all z-10">
            <IoMdShare className="text-[#003d30] text-lg" />
          </button>

          <div className="flex flex-col items-center justify-center mt-16">
            <div className="w-full mb-8">
              <div className="relative w-full h-auto aspect-square scale-125">
                <Image src="/Connector game.jpg" alt={content.title} fill className="object-contain" priority quality={100} />
              </div>
            </div>

            <h1 className="text-[#E8E3C9] text-3xl font-bold text-center mt-8 mb-1">{content.title}</h1>
            <p className="text-[#CFC8A9] text-center text-sm mb-4">{content.subtitle}</p>

            <div className="flex justify-center gap-4 mb-5">
              <Link href="https://t.me/shaposhnykpsy" target="_blank" className="text-[#E8E3C9] hover:text-white transition-colors">
                <FaTelegram size={22} />
              </Link>
              <Link href="https://www.youtube.com/@bible_psychotherapy" target="_blank" className="text-[#E8E3C9] hover:text-white transition-colors">
                <FaYoutube size={22} />
              </Link>
              <Link href="https://www.instagram.com/uimp_psychotherapy" target="_blank" className="text-[#E8E3C9] hover:text-white transition-colors">
                <FaInstagram size={22} />
              </Link>
            </div>

            <div className="w-full mb-4">
              <h2 className="text-[#E8E3C9] text-base font-semibold mb-3 text-center">{content.setTitle}</h2>
              <div className="grid grid-cols-3 gap-2 text-center">
                {content.cards.map((card, i) => (
                  <div key={i} className="bg-[#1a5a48] p-3 rounded-[12px]">
                    <div className="text-[#E8E3C9] font-bold text-2xl leading-tight">{card.count}</div>
                    <div className="text-[#CFC8A9] text-[10px]">{card.label}</div>
                  </div>
                ))}
              </div>
              <p className="text-[#CFC8A9] text-xs text-center mt-2">{content.totalCards}</p>
            </div>

            <div className="w-full space-y-2 mb-4">
              <p className="text-[#E8E3C9] text-xs leading-relaxed">{content.desc1}</p>
              <p className="text-[#E8E3C9] text-xs leading-relaxed">{content.desc2}</p>
              <div className="bg-[#d4a62b]/20 p-3 rounded-lg border border-[#d4a62b]/30">
                <p className="text-[#E8E3C9] text-xs italic">{`"${content.quote}"`}</p>
              </div>
            </div>

            <div className="w-full bg-[#E8E3C9] rounded-xl p-4">
              <div className="text-center mb-2">
                <span className="text-[#003d30] text-2xl font-bold">{content.price}</span>
                <span className="text-[#003d30] text-base"> {currency}</span>
              </div>
              <div className="space-y-1 mb-3">
                <p className="text-[#003d30]/70 text-[10px] flex items-center gap-2">
                  <span>{"📦"}</span> {content.delivery}
                </p>
              </div>
              <button
                onClick={() => setShowOrderForm(true)}
                className="block w-full bg-[#d4a62b] text-[#003d30] py-3 rounded-lg font-bold text-sm text-center hover:bg-[#c49520] transition-all"
              >
                {content.btnOrder}
              </button>
            </div>
          </div>
        </div>
      </div>

      <OrderForm isOpen={showOrderForm} onClose={() => setShowOrderForm(false)} labels={content.form} />
    </div>
  );
}