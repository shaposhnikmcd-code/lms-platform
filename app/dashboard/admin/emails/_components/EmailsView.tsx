'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { HiOutlineChevronRight } from 'react-icons/hi2';
import { useAdminTheme } from '../../_components/adminTheme';
import { AdminShell, AdminPanel } from '../../_components/AdminShell';

// Re-use existing email-template modals from yearly-program. They are universal
// (config-driven) — only the API base / title differ. Bundle gets its own modal
// wrapper below with a config that targets the new /api/admin/emails/bundle-templates.
const PaymentTemplatesModal = dynamic(
  () => import('../../yearly-program/_components/PaymentTemplatesModal'),
  { ssr: false },
);
const RemindersTemplatesModal = dynamic(
  () =>
    import('../../yearly-program/_components/PaymentTemplatesModal').then((m) => ({
      default: m.RemindersTemplatesModal,
    })),
  { ssr: false },
);
const BundleTemplatesModal = dynamic(() => import('./BundleTemplatesModal'), { ssr: false });
const SystemTemplatesModal = dynamic(() => import('./SystemTemplatesModal'), { ssr: false });
const YearlyTelegramTemplatesModal = dynamic(() => import('./YearlyTelegramTemplatesModal'), { ssr: false });
const WelcomeTemplatesModal = dynamic(() => import('./WelcomeTemplatesModal'), { ssr: false });

type ModalKey = 'welcome' | 'payment' | 'reminder' | 'bundle' | 'system' | 'yearly-telegram' | null;

interface CategoryCard {
  key: Exclude<ModalKey, null>;
  emoji: string;
  title: string;
  subtitle: string;
  description: string;
  accent: 'amber' | 'sky' | 'emerald' | 'rose';
}

const CATEGORIES: CategoryCard[] = [
  {
    key: 'welcome',
    emoji: '🎓',
    title: 'Річна — Welcome',
    subtitle: 'Вітальний лист + Telegram-канал',
    description: 'Лист на першу оплату Річної — шлеться автоматично всім, хто записався. Містить запрошення в Telegram-канал.',
    accent: 'emerald',
  },
  {
    key: 'payment',
    emoji: '💳',
    title: 'Річна — Оплати',
    subtitle: 'receipt, plan-changed, admin-end',
    description: 'Транзакційні листи Річної програми — чеки списань та зміни/закриття підписки.',
    accent: 'amber',
  },
  {
    key: 'reminder',
    emoji: '🔔',
    title: 'Річна — Нагадування',
    subtitle: 'Cron-нагадування про оплату',
    description: 'Email-нагадування про оплату наступного місяця: manual flow для разових і cyclical для автосписання.',
    accent: 'sky',
  },
  {
    key: 'bundle',
    emoji: '📦',
    title: 'Курси і Пакети',
    subtitle: 'Підтвердження покупки пакета',
    description: 'Лист з переліком курсів і посиланням на кабінет — шлеться один раз після оплати пакета.',
    accent: 'emerald',
  },
  {
    key: 'yearly-telegram',
    emoji: '📡',
    title: 'Річна Telegram',
    subtitle: 'Запрошення до Telegram-каналу',
    description: 'Лист з invite-посиланням на Telegram-канал Річної — менеджер шле вручну з адмін-картки підписки.',
    accent: 'sky',
  },
  {
    key: 'system',
    emoji: '🛠',
    title: 'Системні',
    subtitle: 'Пароль · Конектор',
    description: 'Скидання пароля та тестове повідомлення менеджеру Конектора.',
    accent: 'rose',
  },
];

export default function EmailsView() {
  const { theme, setTheme } = useAdminTheme();
  const dark = theme === 'dark';
  const [openModal, setOpenModal] = useState<ModalKey>(null);

  return (
    <AdminShell
      theme={theme}
      setTheme={setTheme}
      eyebrow="Admin · Emails"
      title="Листи"
      subtitle="Усі автоматичні листи в одному місці. Натисни категорію, щоб переглянути або відредагувати шаблони."
      maxWidth="max-w-[1200px]"
      backHref="/dashboard/admin"
    >
      <AdminPanel theme={theme} padding="p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((cat) => (
            <CategoryButton
              key={cat.key}
              cat={cat}
              dark={dark}
              onClick={() => setOpenModal(cat.key)}
            />
          ))}
        </div>
      </AdminPanel>

      {openModal === 'welcome' && (
        <WelcomeTemplatesModal theme={theme} onClose={() => setOpenModal(null)} />
      )}
      {openModal === 'payment' && (
        <PaymentTemplatesModal theme={theme} onClose={() => setOpenModal(null)} />
      )}
      {openModal === 'reminder' && (
        <RemindersTemplatesModal theme={theme} onClose={() => setOpenModal(null)} />
      )}
      {openModal === 'bundle' && (
        <BundleTemplatesModal theme={theme} onClose={() => setOpenModal(null)} />
      )}
      {openModal === 'system' && (
        <SystemTemplatesModal theme={theme} onClose={() => setOpenModal(null)} />
      )}
      {openModal === 'yearly-telegram' && (
        <YearlyTelegramTemplatesModal theme={theme} onClose={() => setOpenModal(null)} />
      )}
    </AdminShell>
  );
}

function CategoryButton({
  cat,
  dark,
  onClick,
}: {
  cat: CategoryCard;
  dark: boolean;
  onClick: () => void;
}) {
  const accentMap = {
    amber: dark
      ? 'border-amber-400/30 bg-amber-400/[0.06] hover:border-amber-400/60 hover:bg-amber-400/[0.12] text-amber-200'
      : 'border-amber-300/60 bg-amber-50/70 hover:border-amber-500/70 hover:bg-amber-100/80 text-amber-900',
    sky: dark
      ? 'border-sky-400/30 bg-sky-400/[0.06] hover:border-sky-400/60 hover:bg-sky-400/[0.12] text-sky-200'
      : 'border-sky-300/60 bg-sky-50/70 hover:border-sky-500/70 hover:bg-sky-100/80 text-sky-900',
    emerald: dark
      ? 'border-emerald-400/30 bg-emerald-400/[0.06] hover:border-emerald-400/60 hover:bg-emerald-400/[0.12] text-emerald-200'
      : 'border-emerald-300/60 bg-emerald-50/70 hover:border-emerald-500/70 hover:bg-emerald-100/80 text-emerald-900',
    rose: dark
      ? 'border-rose-400/30 bg-rose-400/[0.06] hover:border-rose-400/60 hover:bg-rose-400/[0.12] text-rose-200'
      : 'border-rose-300/60 bg-rose-50/70 hover:border-rose-500/70 hover:bg-rose-100/80 text-rose-900',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full text-left p-5 rounded-xl border-2 transition-all duration-200 ${accentMap[cat.accent]}`}
    >
      <div className="flex items-start gap-3">
        <div className={`shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-[28px] ${dark ? 'bg-white/[0.06]' : 'bg-white/80'} border ${dark ? 'border-white/[0.08]' : 'border-stone-200'}`}>
          <span aria-hidden>{cat.emoji}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className={`text-[15px] font-bold leading-tight ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
              {cat.title}
            </h3>
            <HiOutlineChevronRight className={`shrink-0 text-[16px] opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all ${dark ? 'text-slate-300' : 'text-stone-500'}`} />
          </div>
          <p className={`text-[12px] mt-0.5 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
            {cat.subtitle}
          </p>
          <p className={`text-[12px] mt-2 leading-relaxed ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
            {cat.description}
          </p>
        </div>
      </div>
    </button>
  );
}

