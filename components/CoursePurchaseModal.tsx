'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { FaWallet } from 'react-icons/fa';
import { useTranslations } from 'next-intl';

// Діалог (форма оплати, валідація, promo, 4 іконки, next-auth useSession) винесено
// в окремий чанк і довантажується ЛИШЕ коли юзер клікне "Купити". На першому
// завантаженні сторінки /courses економимо ~20-25 KB JS у критичному шляху.
const CoursePurchaseDialog = dynamic(() => import('./CoursePurchaseDialog'), {
  ssr: false,
});

interface CoursePurchaseModalProps {
  courseName: string;
  price: number;
  courseId: string;
  currency?: string;
  buttonLabel?: string;
  compact?: boolean;
  /// Для CHOICE_FREE пакетів — передається вибір клієнта на сервер
  selectedFreeSlugs?: string[];
  /// Якщо true — кнопка покупки disabled (наприклад, клієнт не обрав безкоштовний)
  disabled?: boolean;
  /// Якщо true — показати toggle "Разова / Циклічна 9 міс." (для yearly-program-monthly).
  allowRecurringChoice?: boolean;
}

export default function CoursePurchaseModal({
  courseName,
  price,
  courseId,
  currency = 'грн',
  buttonLabel,
  compact = false,
  selectedFreeSlugs,
  disabled = false,
  allowRecurringChoice = false,
}: CoursePurchaseModalProps) {
  const t = useTranslations('PurchaseModal');
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className={`group relative inline-flex items-center gap-3 bg-[#D4A017] text-white font-bold rounded-xl mx-auto justify-center overflow-hidden shadow-md shadow-[#D4A017]/20 transition-all duration-300 hover:bg-[#c69414] hover:shadow-lg hover:shadow-[#D4A017]/30 border border-[#D4A017]/30 disabled:opacity-50 disabled:cursor-not-allowed ${compact ? 'py-2.5 px-6 text-sm' : 'py-2.5 px-3 text-sm'}`}
      >
        <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <FaWallet className={`relative ${compact ? 'text-base' : 'text-xl'}`} />
        <span className="relative">{buttonLabel ?? t('btnBuy')}</span>
      </button>

      {isOpen && (
        <CoursePurchaseDialog
          courseName={courseName}
          price={price}
          courseId={courseId}
          currency={currency}
          compact={compact}
          selectedFreeSlugs={selectedFreeSlugs}
          allowRecurringChoice={allowRecurringChoice}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
