'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiOutlineRocketLaunch, HiOutlineEnvelopeOpen, HiOutlineArrowPath, HiOutlineUserPlus } from 'react-icons/hi2';
import type { Theme } from '../../_components/adminTheme';
import type { CohortListItem } from './types';
import SendEmailsModal from './SendEmailsModal';
import AddStudentModal from './AddStudentModal';
import LaunchProgramModal from './LaunchProgramModal';
import MailerFromBadge from '../../_components/MailerFromBadge';
import { useUIFeedback, HoverInfo } from './UIFeedback';

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
  const { toast, confirm } = useUIFeedback();
  const [busy, setBusy] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [launchModalOpen, setLaunchModalOpen] = useState(false);
  // Кількість підписок, яким при запуску не вдалося відкрити доступ. Лишаємо від запуску, поки
  // менеджер не повторить — кнопка "Повторити запуск" з'являється поряд.
  const [failedCount, setFailedCount] = useState<number>(0);

  async function retry() {
    const ok = await confirm({
      title: 'Повторити запуск?',
      description: 'Спробуємо ще раз відкрити доступ для тих, у кого минулого разу не вийшло. Тих, у кого вже відкрито — пропустимо (без дублів).',
      confirmLabel: 'Повторити',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/yearly-program/cohorts/${cohort.id}/launch?retry=1`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        toast('error', data.error ?? res.statusText);
        return;
      }
      const s = data.summary;
      setFailedCount(s.failed);
      const variant: 'success' | 'info' = s.failed > 0 ? 'info' : 'success';
      toast(variant, `🔁 Повторний запуск\nДоступ відкрито: ${s.opened}/${s.total}${s.failed > 0 ? ` · Помилок: ${s.failed}` : ''}`);
      router.refresh();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setLaunchModalOpen(true)}
            disabled={busy || !!cohort.launchedAt}
            className={`inline-flex items-center gap-2 px-5 py-3 rounded-lg text-[14px] font-bold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              cohort.launchedAt
                ? dark ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300' : 'bg-emerald-50 border-emerald-300/60 text-emerald-800'
                : cohort.launchScheduledFor
                  ? dark ? 'bg-indigo-500/[0.10] border-indigo-400/35 text-indigo-200 hover:bg-indigo-500/15 shadow-[0_0_20px_rgba(129,140,248,0.10)]'
                          : 'bg-indigo-50 border-indigo-300/70 text-indigo-900 hover:bg-indigo-100 shadow-[0_4px_14px_rgba(129,140,248,0.18)]'
                  : dark
                    ? 'bg-gradient-to-br from-amber-400/20 to-amber-500/30 border-amber-400/40 text-amber-100 hover:from-amber-400/30 hover:to-amber-500/40 shadow-[0_0_24px_rgba(212,168,67,0.15)]'
                    : 'bg-gradient-to-br from-amber-300 to-amber-400 border-amber-400/60 text-amber-950 hover:from-amber-400 hover:to-amber-500 shadow-[0_4px_14px_rgba(212,168,67,0.35)]'
            }`}
          >
            <HiOutlineRocketLaunch className="text-lg" />
            {cohort.launchedAt
              ? 'Програма запущена'
              : cohort.launchScheduledFor
                ? `Запуск ${humanizeShortRelative(cohort.launchScheduledFor)}`
                : 'Запустити програму'}
          </button>
          <HoverInfo
            theme={theme}
            title={cohort.launchedAt ? 'Програма вже запущена' : cohort.launchScheduledFor ? 'Запуск заплановано' : 'Що відбудеться при запуску'}
            body={
              cohort.launchedAt
                ? `Запущено: ${new Date(cohort.launchedAt).toLocaleString('uk-UA')}\n\nПовторно запустити вже не можна. Нові оплати не приймаються в цей запуск.\n\nЯкщо потрібно додати студента вручну — скористуйтесь кнопкою "Додати студента" поряд.`
                : cohort.launchScheduledFor
                  ? `Заплановано на: ${new Date(cohort.launchScheduledFor).toLocaleString('uk-UA')}\n\nCron перевіряє щодоби о 04:00 UTC. Фактичний запуск може зсунутись на ≤24h після цієї дати.\n\nКлік на кнопку — щоб перепланувати, скасувати або запустити одразу.`
                  : '🔓 Відкриває доступ у SendPulse усім, хто оплатив\n📅 Перераховує "Доступ до" по новій логіці (від дати запуску)\n🚀 Фіксує дату фактичного запуску\n\nДва режими: запустити одразу або запланувати на дату.\n\nWelcome-листи тут НЕ йдуть — це окрема кнопка ✉️ Запустити розсилку.'
            }
          />
        </div>

        {cohort.launchedAt && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAddStudentOpen(true)}
              disabled={busy}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold border transition-colors disabled:opacity-50 ${
                dark
                  ? 'bg-white/[0.04] border-white/[0.1] text-slate-200 hover:bg-rose-500/10 hover:border-rose-400/40 hover:text-rose-200'
                  : 'bg-white/80 border-stone-300/60 text-stone-800 hover:bg-rose-50 hover:border-rose-400/60 hover:text-rose-900'
              }`}
            >
              <HiOutlineUserPlus className="text-base" />
              Додати студента
            </button>
            <HoverInfo
              theme={theme}
              title="Додавання студента вручну"
              body={'Для студента, який не встиг купити Річну програму до запуску.\n\n📨 Згенеруй персональне посилання → відправ йому через email/Telegram\n💳 Студент платить за лінком → потрапляє в таблицю з пілюлею «Додано вручну»\n🎯 Натискаєш «Екстра Запуск» у його рядку → відкривається SendPulse + йде welcome-лист'}
              align="end"
            />
          </div>
        )}

        {cohort.launchedAt && failedCount > 0 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={retry}
              disabled={busy}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold border transition-colors disabled:opacity-50 ${
                dark
                  ? 'bg-rose-500/10 border-rose-400/30 text-rose-200 hover:bg-rose-500/20'
                  : 'bg-rose-50 border-rose-300/60 text-rose-900 hover:bg-rose-100'
              }`}
            >
              <HiOutlineArrowPath className="text-base" />
              Повторити запуск ({failedCount})
            </button>
            <HoverInfo
              theme={theme}
              title="Повторний запуск"
              body={`Минулого запуску у ${failedCount} підписок не вдалося відкрити доступ (SendPulse rate-limit чи мережа).\n\nПовторний запуск спробує знову відкрити доступ — тих, у кого вже відкрито, пропустить (idempotent).`}
            />
          </div>
        )}

        <div className="flex items-center gap-1.5">
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
            {cohort.emailScheduledFor ? (
              <span className={`ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                dark ? 'bg-indigo-500/20 text-indigo-200' : 'bg-indigo-100 text-indigo-900'
              }`}>
                📅 {new Date(cohort.emailScheduledFor).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : cohort.emailSentAt ? (
              <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                dark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-800'
              }`}>
                ✓ {new Date(cohort.emailSentAt).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit' })}
              </span>
            ) : null}
          </button>
          <HoverInfo
            theme={theme}
            title="Як працює розсилка"
            body={
              <div className="space-y-3">
                <div className="whitespace-pre-line">
                  {'Welcome-листи всім підписникам цього запуску.\n\nУ модалці розсилки одразу видно сам лист — можна відредагувати, надіслати тестовий, потім запустити.\n\n· Зараз — миттєва послідовна відправка\n· Запланувати — cron щодоби о 04:00 UTC надсилає в призначений день\n\nДублі виключено: тим, хто вже отримав, повторно не надсилає.'}
                </div>
                <div className={`pt-2 border-t ${dark ? 'border-white/[0.08]' : 'border-stone-200'}`}>
                  <div className={`text-[10px] uppercase tracking-[0.18em] font-medium mb-1.5 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                    Відправляємо з
                  </div>
                  <MailerFromBadge theme={theme} variant="compact" />
                </div>
              </div>
            }
          />
        </div>
      </div>

      {sendModalOpen && (
        <SendEmailsModal
          cohort={cohort}
          theme={theme}
          onClose={() => setSendModalOpen(false)}
        />
      )}
      {addStudentOpen && (
        <AddStudentModal
          cohort={cohort}
          theme={theme}
          onClose={() => setAddStudentOpen(false)}
        />
      )}
      {launchModalOpen && (
        <LaunchProgramModal
          cohort={cohort}
          paidPendingCount={cohort.subscriptionsCount}
          theme={theme}
          onClose={() => setLaunchModalOpen(false)}
        />
      )}
    </div>
  );
}

function humanizeShortRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  if (diffMs < 0) return 'настав ⚠';
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const target = new Date(d); target.setHours(0, 0, 0, 0);
  const dayDelta = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  const time = d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  if (dayDelta === 0) return `сьогодні ${time}`;
  if (dayDelta === 1) return `завтра ${time}`;
  if (dayDelta < 7) return d.toLocaleDateString('uk-UA', { weekday: 'short' }) + ' ' + time;
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short' });
}
