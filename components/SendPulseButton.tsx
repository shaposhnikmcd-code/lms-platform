'use client';

import Link from 'next/link';
import { FaGraduationCap } from 'react-icons/fa';
import { useTranslations } from 'next-intl';

interface SendPulseButtonProps {
  url: string;
  label?: string;
}

export default function SendPulseButton({ url, label }: SendPulseButtonProps) {
  const t = useTranslations('PurchaseModal');
  return (
    <Link
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-3 bg-[#D4A017] text-white font-bold py-5 px-12 rounded-xl hover:bg-[#b88913] transition-all text-lg w-full justify-center"
    >
      <FaGraduationCap className="text-xl" />
      {label ?? t('btnBuy')}
    </Link>
  );
}
