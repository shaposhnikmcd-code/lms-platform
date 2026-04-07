'use client';

import { Link } from '@/i18n/navigation';
import { FaTelegram, FaYoutube, FaInstagram, FaWhatsapp, FaEnvelope } from 'react-icons/fa';
import { IoMdShare, IoMdClose, IoMdCheckmark } from 'react-icons/io';
import { IoArrowBack, IoCopyOutline } from 'react-icons/io5';
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
  deliveryType: string;
  deliveryWarehouse: string;
  deliveryCourier: string;
  gameLabel: string;
  total: string;
  calculating: string;
  selectCity: string;
  selectBranch: string;
  novaPoshtaDelivery: string;
  plusDelivery: string;
  euPickupNote: string;
  courierAddressTitle: string;
  streetLabel: string;
  houseLabel: string;
  corpusLabel: string;
  apartmentLabel: string;
  apartmentOrOfficeLabel: string;
  optional: string;
  enterStreet: string;
  firstSelectCity: string;
  firstSelectStreet: string;
  streetsNotFound: string;
  buildingsNotFound: string;
  exampleHouse: string;
  exampleCorpus: string;
  exampleApt: string;
  nameUkrainianError: string;
  nameFullError: string;
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
    share: { title: string; copy: string; copied: string };
  };
  currency: string;
}

const shareUrl = "https://www.uimp.com.ua/links/connector";
const shareTitle = "Гра «Конектор» — психологічна гра для пар від UIMP";

export default function ConnectorClient({ content, currency }: Props) {
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    setShowShareModal(true);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`;
  const waShareUrl = `https://wa.me/?text=${encodeURIComponent(shareTitle + ' ' + shareUrl)}`;
  const emailShareUrl = `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0c4a3a] to-[#06382d] p-6">
      <div className="container mx-auto max-w-[500px]">
        <div className="bg-[#003d30] rounded-[32px] p-5 md:p-6 shadow-2xl relative">

          <Link href="/games"
            className="absolute top-4 left-4 w-[38px] h-[38px] bg-[#E0E0E0] rounded-full flex items-center justify-center hover:opacity-80 transition-all z-10">
            <IoArrowBack className="text-[#003d30] text-lg" />
          </Link>

          <button
            onClick={handleShare}
            className="absolute top-4 right-4 w-[38px] h-[38px] bg-[#E0E0E0] rounded-full flex items-center justify-center hover:opacity-80 transition-all z-10">
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
              <a href="https://t.me/shaposhnykpsy" target="_blank" rel="noopener noreferrer" className="text-[#E8E3C9] hover:text-white transition-colors">
                <FaTelegram size={22} />
              </a>
              <a href="https://www.youtube.com/@bible_psychotherapy" target="_blank" rel="noopener noreferrer" className="text-[#E8E3C9] hover:text-white transition-colors">
                <FaYoutube size={22} />
              </a>
              <a href="https://www.instagram.com/uimp_psychotherapy" target="_blank" rel="noopener noreferrer" className="text-[#E8E3C9] hover:text-white transition-colors">
                <FaInstagram size={22} />
              </a>
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

      {/* Share Modal */}
      {showShareModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowShareModal(false)}
        >
          <div
            className="w-full max-w-[500px] bg-white rounded-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[#003d30] font-bold text-lg">{content.share.title}</h3>
              <button onClick={() => setShowShareModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
                <IoMdClose className="text-gray-500" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-5">
              <a href={tgShareUrl} target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(38,165,228,0.1)' }}>
                  <FaTelegram style={{ color: '#26A5E4', fontSize: '1.6rem' }} />
                </div>
                <span className="text-xs text-gray-500">{"Telegram"}</span>
              </a>

              <a href={waShareUrl} target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(37,211,102,0.1)' }}>
                  <FaWhatsapp style={{ color: '#25D366', fontSize: '1.6rem' }} />
                </div>
                <span className="text-xs text-gray-500">{"WhatsApp"}</span>
              </a>

              <a href={emailShareUrl}
                className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(28,58,46,0.08)' }}>
                  <FaEnvelope style={{ color: '#1C3A2E', fontSize: '1.4rem' }} />
                </div>
                <span className="text-xs text-gray-500">{"Email"}</span>
              </a>

              <button onClick={handleCopy}
                className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-colors" style={{ background: copied ? 'rgba(28,58,46,0.15)' : 'rgba(28,58,46,0.08)' }}>
                  {copied
                    ? <IoMdCheckmark style={{ color: '#1C3A2E', fontSize: '1.4rem' }} />
                    : <IoCopyOutline style={{ color: '#1C3A2E', fontSize: '1.4rem' }} />
                  }
                </div>
                <span className="text-xs text-gray-500">{copied ? content.share.copied : content.share.copy}</span>
              </button>
            </div>

            <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-4 py-3">
              <span className="text-xs text-gray-400 truncate flex-1">{shareUrl}</span>
              <button onClick={handleCopy} className="text-xs font-medium text-[#003d30] flex-shrink-0">
                {copied ? "✓" : content.share.copy}
              </button>
            </div>
          </div>
        </div>
      )}

      <OrderForm isOpen={showOrderForm} onClose={() => setShowOrderForm(false)} labels={content.form} />
    </div>
  );
}