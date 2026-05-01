'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiOutlineRocketLaunch, HiOutlineEnvelopeOpen, HiOutlinePencilSquare, HiOutlineInformationCircle } from 'react-icons/hi2';
import type { Theme } from '../../_components/adminTheme';
import type { CohortListItem } from './types';
import EmailTemplateModal from './EmailTemplateModal';
import SendEmailsModal from './SendEmailsModal';
import CohortInfoModal from './CohortInfoModal';
import MailerFromBadge from '../../_components/MailerFromBadge';

/// Великі кнопки дій над cohort-ом: 🚀 Запустити · ✉️ Запустити розсилку · 📧 E-mail · ℹ️
export default function CohortActions({
  cohort,
  theme,
}: {
  cohort: CohortListItem;
  theme: Theme;
}) {
  const dark = theme === 'dark';
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  async function launch() {
    if (cohort.launchedAt) {
      alert('Програма вже запущена.');
      return;
    }
    if (!window.confirm(`Запустити "${cohort.name}"?\n\nЦя дія:\n• Відкриє доступ у SendPulse усім, хто оплатив\n• Перерахує дату завершення доступу для кожної підписки\n• Зафіксує дату запуску\n\nПродовжити?`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/yearly-program/cohorts/${cohort.id}/launch`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(`Помилка: ${data.error ?? res.statusText}`);
      } else {
        const s = data.summary;
        alert(`✅ Програму "${cohort.name}" запущено!\n\nДоступ відкрито: ${s.opened}/${s.total}\nПомилок: ${s.failed}`);
        router.refresh();
      }
    } catch (e) {
      alert(`Помилка: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`mb-5 rounded-2xl border p-4 ${
      dark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white/55 border-stone-300/50 shadow-[0_1px_2px_rgba(68,64,60,0.04)]'
    }`}>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={launch}
          disabled={busy || !!cohort.launchedAt}
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-lg text-[14px] font-bold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            cohort.launchedAt
              ? dark ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300' : 'bg-emerald-50 border-emerald-300/60 text-emerald-800'
              : dark
                ? 'bg-gradient-to-br from-amber-400/20 to-amber-500/30 border-amber-400/40 text-amber-100 hover:from-amber-400/30 hover:to-amber-500/40 shadow-[0_0_24px_rgba(212,168,67,0.15)]'
                : 'bg-gradient-to-br from-amber-300 to-amber-400 border-amber-400/60 text-amber-950 hover:from-amber-400 hover:to-amber-500 shadow-[0_4px_14px_rgba(212,168,67,0.35)]'
          }`}
          title={cohort.launchedAt
            ? `Запущено: ${new Date(cohort.launchedAt).toLocaleString('uk-UA')}`
            : 'Відкрити доступ усім оплаченим + зафіксувати дату запуску'}
        >
          <HiOutlineRocketLaunch className="text-lg" />
          {cohort.launchedAt ? 'Програма запущена' : 'Запустити програму'}
        </button>

        <button
          type="button"
          onClick={() => setSendModalOpen(true)}
          disabled={busy}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold border transition-colors disabled:opacity-50 ${
            dark
              ? 'bg-white/[0.04] border-white/[0.1] text-slate-200 hover:bg-white/[0.08]'
              : 'bg-white/80 border-stone-300/60 text-stone-800 hover:bg-stone-50'
          }`}
        >
          <HiOutlineEnvelopeOpen className="text-base" />
          Запустити розсилку
          {cohort.emailScheduledFor && !cohort.emailSentAt && (
            <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${
              dark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800'
            }`}>
              {new Date(cohort.emailScheduledFor).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {cohort.emailSentAt && (
            <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${
              dark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-800'
            }`}>
              ✓ {new Date(cohort.emailSentAt).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit' })}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setEmailModalOpen(true)}
          disabled={busy}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold border transition-colors disabled:opacity-50 ${
            dark
              ? 'bg-white/[0.04] border-white/[0.1] text-slate-200 hover:bg-white/[0.08]'
              : 'bg-white/80 border-stone-300/60 text-stone-800 hover:bg-stone-50'
          }`}
        >
          <HiOutlinePencilSquare className="text-base" />
          E-mail запуску
        </button>

        <div className="ml-auto flex items-center gap-3">
          <MailerFromBadge theme={theme} />
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            aria-label="Як це все працює"
            className={`w-9 h-9 rounded-full flex items-center justify-center text-base transition-colors border ${
              dark
                ? 'border-white/[0.1] text-slate-400 hover:bg-white/[0.06] hover:text-amber-300'
                : 'border-stone-300/60 text-stone-500 hover:bg-stone-100 hover:text-amber-800'
            }`}
            title="Як це все працює"
          >
            <HiOutlineInformationCircle />
          </button>
        </div>
      </div>

      {emailModalOpen && (
        <EmailTemplateModal
          cohort={cohort}
          theme={theme}
          onClose={() => setEmailModalOpen(false)}
        />
      )}
      {sendModalOpen && (
        <SendEmailsModal
          cohort={cohort}
          theme={theme}
          onClose={() => setSendModalOpen(false)}
        />
      )}
      {infoOpen && <CohortInfoModal theme={theme} onClose={() => setInfoOpen(false)} />}
    </div>
  );
}
