'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Theme } from '../../_components/adminTheme';

/// Модалка "Флоу Річної програми" — менеджер-friendly BA-діаграма (swim lane):
///   • 7 акторів (рядки): Студент / WayForPay / Наш сайт / Менеджер / SendPulse / Telegram (компактний) / Email
///   • 6 фаз (колонки): оплата → старт+welcome → навчання → перед кінцем → пільгові → закриття
///   • Кожен бокс пронумерований (1-21)
///   • Дії менеджера підсвічені amber/gold + 👆 пілом — палітра 1:1 з реальною кнопкою «Запустити програму»
///   • Email-боксы мають чіп «📝 Листи Платежів / Нагадування» — щоб менеджер бачив, де редагується шаблон
///   • Telegram lane скомпресовано до 64px (всередині лише один бокс — invite-link)

type ActorKind = 'student' | 'wfp' | 'platform' | 'manager' | 'sp' | 'tg' | 'email';

const LANES: { id: ActorKind; label: string; subLabel?: string; emoji: string }[] = [
  { id: 'student',  label: 'Студент',     emoji: '👤' },
  { id: 'wfp',      label: 'WayForPay',   emoji: '💳' },
  { id: 'platform', label: 'Наш сайт',    emoji: '⚙️' },
  { id: 'manager',  label: 'Менеджер',    emoji: '🧑‍💼' },
  { id: 'sp',       label: 'SendPulse',   emoji: '🎓' },
  { id: 'tg',       label: 'Telegram',    emoji: '🤖' },
  { id: 'email',    label: 'Email',       subLabel: 'шлемо ми', emoji: '✉️' },
];

const PHASES = [
  { id: 'pay',     label: '1 · ОПЛАТА',                x0: 90,   x1: 290,  cx: 190 },
  { id: 'launch',  label: '2 · СТАРТ ГРУПИ + WELCOME', x0: 290,  x1: 660,  cx: 475 },
  { id: 'active',  label: '3 · НАВЧАННЯ',              x0: 660,  x1: 880,  cx: 770 },
  { id: 'pre',     label: '4 · ПЕРЕД КІНЦЕМ',          x0: 880,  x1: 1060, cx: 970 },
  { id: 'grace',   label: '5 · ПІЛЬГОВІ 7 ДНІВ',       x0: 1060, x1: 1240, cx: 1150 },
  { id: 'expired', label: '6 · ЗАКРИТТЯ ДОСТУПУ',      x0: 1240, x1: 1450, cx: 1345 },
] as const;

const LANE_TOP = 50;
const LANE_H_DEFAULT = 96;
const LANE_H_TG = 64;
const SVG_W = 1450;

const LANE_HEIGHTS: Record<ActorKind, number> = {
  student: LANE_H_DEFAULT,
  wfp: LANE_H_DEFAULT,
  platform: LANE_H_DEFAULT,
  manager: LANE_H_DEFAULT,
  sp: LANE_H_DEFAULT,
  tg: LANE_H_TG,
  email: LANE_H_DEFAULT,
};

const LANE_TOPS: Record<ActorKind, number> = (() => {
  const r = {} as Record<ActorKind, number>;
  let acc = LANE_TOP;
  for (const lane of LANES) {
    r[lane.id] = acc;
    acc += LANE_HEIGHTS[lane.id];
  }
  return r;
})();

const SVG_H = LANE_TOP + LANES.reduce((s, l) => s + LANE_HEIGHTS[l.id], 0);

const ACTIVITY_H = 60;
const MGR_H = 66;
const EMAIL_BOX_H = 76;
const TG_BOX_H = 44;

const boxH = (kind: ActorKind, isMgr = false): number => {
  if (isMgr) return MGR_H;
  if (kind === 'email') return EMAIL_BOX_H;
  if (kind === 'tg') return TG_BOX_H;
  return ACTIVITY_H;
};

// Координати центрів lane-ів (для довідки в edge-d):
//   student=98 · wfp=194 · platform=290 · manager=386 · sp=482 · tg=562 · email=642
// Top/bottom боксів:
//   student PlanBox(84): 56 / 140
//   wfp(60):    164 / 224       platform(60): 260 / 320
//   manager(66):353 / 419       sp(60):       452 / 512
//   tg(44):     540 / 584       email(76):    604 / 680

export default function WorkflowDiagramModal({ theme, onClose }: { theme: Theme; onClose: () => void }) {
  const dark = theme === 'dark';
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  if (!mounted) return null;

  const c: Colors = dark ? darkColors : lightColors;
  const arrowId = `wf-arrow-${dark ? 'd' : 'l'}`;
  const arrowAccentId = `wf-arrow-acc-${dark ? 'd' : 'l'}`;
  const managerShadowId = `wf-mgr-shadow-${dark ? 'd' : 'l'}`;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`relative w-full max-h-[94vh] overflow-y-auto rounded-2xl shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          dark ? 'bg-zinc-900 border border-white/10 text-slate-200' : 'bg-stone-50 border border-stone-200 text-stone-800'
        }`}
        style={{ maxWidth: 'min(1520px, 96vw)' }}
      >
        {/* Header */}
        <div className={`sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b backdrop-blur ${
          dark ? 'bg-zinc-900/95 border-white/10' : 'bg-stone-50/95 border-stone-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-[18px] ${
              dark ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30' : 'bg-amber-100 text-amber-800 border border-amber-300/60'
            }`}>🧭</div>
            <div>
              <h3 className="text-[16px] font-bold leading-tight">Флоу Річної програми</h3>
              <p className={`text-[12px] leading-tight mt-0.5 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                Хто і що робить · де ваші кнопки · від оплати до закриття доступу
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрити"
            className={`w-8 h-8 rounded-full flex items-center justify-center text-[14px] transition-colors ${
              dark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-stone-100 text-stone-500'
            }`}
          >✕</button>
        </div>

        <div className="px-6 py-5">
          {/* SWIM LANE DIAGRAM */}
          <div className="overflow-x-auto -mx-6 px-6">
            <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" style={{ minWidth: 1100, maxWidth: SVG_W, display: 'block' }}>
              <defs>
                <marker id={arrowId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={c.edgeStroke} />
                </marker>
                <marker id={arrowAccentId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={c.edgeAccent} />
                </marker>
                <filter id={managerShadowId} x="-20%" y="-20%" width="140%" height="160%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#D4A843" floodOpacity={dark ? 0.40 : 0.30} />
                </filter>
              </defs>

              {/* Lane backgrounds + headers (per-lane heights) */}
              {LANES.map((lane) => {
                const top = LANE_TOPS[lane.id];
                const h = LANE_HEIGHTS[lane.id];
                const palette = c.actor[lane.id];
                return (
                  <g key={lane.id}>
                    <rect x={0} y={top} width={SVG_W} height={h} fill={palette.laneBg} />
                    <rect x={0} y={top} width={90} height={h} fill={palette.laneHeaderBg} stroke={c.laneSep} strokeWidth={1} />
                    <text x={45} y={top + h / 2 - (lane.subLabel ? 12 : 8)} textAnchor="middle" fontSize={16} fill={palette.text} style={{ fontFamily: 'inherit' }}>
                      {lane.emoji}
                    </text>
                    <text x={45} y={top + h / 2 + (lane.subLabel ? 6 : 14)} textAnchor="middle" fontSize={10.5} fontWeight={700} fill={palette.text} style={{ fontFamily: 'inherit' }}>
                      {lane.label}
                    </text>
                    {lane.subLabel && (
                      <text x={45} y={top + h / 2 + 19} textAnchor="middle" fontSize={8.5} fontWeight={500} fill={palette.subText} style={{ fontFamily: 'inherit' }}>
                        {lane.subLabel}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Lane separators */}
              {LANES.map((lane, i) => i > 0 && (
                <line key={`lsep-${i}`} x1={0} x2={SVG_W} y1={LANE_TOPS[lane.id]} y2={LANE_TOPS[lane.id]} stroke={c.laneSep} strokeWidth={1} />
              ))}
              <line x1={0} x2={SVG_W} y1={LANE_TOP} y2={LANE_TOP} stroke={c.laneSep} strokeWidth={1} />
              <line x1={0} x2={SVG_W} y1={SVG_H} y2={SVG_H} stroke={c.laneSep} strokeWidth={1} />

              {/* Phase headers */}
              {PHASES.map((p) => (
                <g key={p.id}>
                  <rect x={p.x0} y={0} width={p.x1 - p.x0} height={LANE_TOP} fill={c.phaseHeaderFill} stroke={c.laneSep} strokeWidth={1} />
                  <text x={p.cx} y={LANE_TOP / 2} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={700} letterSpacing={1} fill={c.phaseHeaderText} style={{ fontFamily: 'inherit' }}>
                    {p.label}
                  </text>
                </g>
              ))}
              {PHASES.map((p, i) => i > 0 && (
                <line key={`psep-${i}`} x1={p.x0} x2={p.x0} y1={LANE_TOP} y2={SVG_H} stroke={c.phaseSep} strokeDasharray="3 4" strokeWidth={1} />
              ))}

              {/* ═══════════ EDGES ═══════════ */}

              {/* 1 · ОПЛАТА */}
              <Edge d="M 190 140 L 190 164" c={c} arrowId={arrowId} />            {/* 1 → 2 */}
              <Edge d="M 190 224 L 190 260" c={c} arrowId={arrowId} />            {/* 2 → 3 */}
              <Edge d="M 190 320 L 190 540" c={c} arrowId={arrowId} dashed />     {/* 3 → 4 (генерує invite, якщо autoAdd) */}
              <Edge d="M 190 584 L 190 604" c={c} arrowId={arrowId} dashed />     {/* 4 → 5 (вкладає invite у лист про оплату) */}

              <Edge d="M 280 290 L 304 290" c={c} arrowId={arrowAccentId} accent />

              {/* 2 · СТАРТ ГРУПИ + WELCOME */}
              <Edge d="M 390 353 L 390 320" c={c} arrowId={arrowId} />            {/* 6 → 8 */}
              <Edge d="M 390 419 L 390 452" c={c} arrowId={arrowId} />            {/* 6 → 7 */}
              <Edge d="M 390 512 L 390 604" c={c} arrowId={arrowId} />            {/* 7 → 9 */}
              <Edge d="M 280 562 L 300 604" c={c} arrowId={arrowId} dashed />     {/* 4 → 9 (invite реюзається у welcome-лист) */}

              <Edge d="M 480 290 L 684 290" c={c} arrowId={arrowAccentId} accent />

              {/* 3 · НАВЧАННЯ */}
              <Edge d="M 770 224 L 770 260" c={c} arrowId={arrowId} dashed />     {/* 11 → 12 */}
              <Edge d="M 770 320 L 770 604" c={c} arrowId={arrowId} dashed />     {/* 12 → 13 */}

              <Edge d="M 860 290 L 884 290" c={c} arrowId={arrowAccentId} accent />

              {/* 4 · ПЕРЕД КІНЦЕМ */}
              <Edge d="M 970 320 L 970 604" c={c} arrowId={arrowId} dashed />     {/* 14 → 15 */}

              <Edge d="M 1055 290 L 1069 290" c={c} arrowId={arrowAccentId} accent />

              {/* 5 · ПІЛЬГОВІ 7 ДНІВ */}
              <Edge d="M 1150 320 L 1150 604" c={c} arrowId={arrowId} dashed />   {/* 16 → 17 */}

              <Edge d="M 1235 290 L 1259 290" c={c} arrowId={arrowAccentId} accent />

              {/* 6 · ЗАКРИТТЯ ДОСТУПУ */}
              <Edge d="M 1345 260 L 1345 224" c={c} arrowId={arrowId} />          {/* 19 → 18 */}
              <Edge d="M 1345 320 L 1345 452" c={c} arrowId={arrowId} />          {/* 19 → 20 */}
              <Edge d="M 1345 512 L 1345 604" c={c} arrowId={arrowId} />          {/* 20 → 21 */}

              {/* ═══════════ NODES ═══════════ */}

              {/* 1 · ОПЛАТА */}
              <PlanBox cx={190} cy={98} w={200} h={84} num={1} c={c} title="На сайті купує підписку" plans={[
                { color: '#3B82F6', label: 'Річна', price: '15 000 ₴ разово' },
                { color: '#22C55E', label: 'Місячна авто', price: '2 200 ₴ × 9 місяців' },
                { color: '#F59E0B', label: 'Місячна разова', price: '2 200 ₴ за місяць' },
              ]} />
              <Activity cx={190} cy={194} w={180} num={2}  kind="wfp"      title="Приймає оплату" sub="запам'ятовує карту (для авто)" c={c} mgrShadowId={managerShadowId} />
              <Activity cx={190} cy={290} w={180} num={3}  kind="platform" title="Реєструє підписку" sub="у таблиці з'являється студент" c={c} mgrShadowId={managerShadowId} />
              <Activity cx={190} cy={562} w={180} num={4}  kind="tg"       title="Генерує invite-link" sub="одноразовий · якщо autoAdd ON" c={c} mgrShadowId={managerShadowId} />
              <Activity cx={190} cy={642} w={180} num={5}  kind="email"    title="Лист про оплату" sub="invite-link вкладено" editLocation="Листи Платежів" c={c} mgrShadowId={managerShadowId} />

              {/* 2 · СТАРТ ГРУПИ + WELCOME */}
              <Activity cx={390} cy={290} w={180} num={8}  kind="platform" title="Підписка стає активною" sub="у таблиці статус «Активна»" c={c} mgrShadowId={managerShadowId} />
              <Activity cx={390} cy={386} w={210} num={6}  kind="manager"  title="🚀 Запустити програму" sub="одразу шле welcome-лист (можна вимкнути)" c={c} mgrShadowId={managerShadowId} />
              <Activity cx={390} cy={482} w={180} num={7}  kind="sp"       title="Відкриває доступ до курсу" sub="усім, хто оплатив" c={c} mgrShadowId={managerShadowId} />
              <Activity cx={390} cy={642} w={180} num={9}  kind="email"    title="Welcome-лист про старт" sub="одночасно з відкриттям доступу" editLocation="модалка запуску" c={c} mgrShadowId={managerShadowId} />

              {/* 3 · НАВЧАННЯ */}
              <Activity cx={770} cy={98}  w={180} num={10} kind="student"  title="🎓 Проходить курс" sub="матеріали в SendPulse" c={c} mgrShadowId={managerShadowId} />
              <Activity cx={770} cy={194} w={180} num={11} kind="wfp"      title="Списує 2 200 ₴ щомісяця" sub="лише при авто · до 9 разів" c={c} mgrShadowId={managerShadowId} />
              <Activity cx={770} cy={290} w={180} num={12} kind="platform" title="Доступ +30 днів" sub="після кожного успіху" c={c} mgrShadowId={managerShadowId} />
              <Activity cx={770} cy={642} w={180} num={13} kind="email"    title="Лист-чек про списання" sub="за кожне успішне (тільки місячна)" editLocation="Листи Платежів" c={c} mgrShadowId={managerShadowId} />

              {/* 4 · ПЕРЕД КІНЦЕМ */}
              <Activity cx={970} cy={290} w={170} num={14} kind="platform" title="Автоперевірка щодня" sub="бачить, у кого скоро кінець" c={c} mgrShadowId={managerShadowId} />
              <Activity cx={970} cy={642} w={170} num={15} kind="email"    title="Нагадування -3д · -1д" sub="ТІЛЬКИ місячна разова" editLocation="Листи Нагадування" c={c} mgrShadowId={managerShadowId} />

              {/* 5 · ПІЛЬГОВІ 7 ДНІВ */}
              <Activity cx={1150} cy={290} w={170} num={16} kind="platform" title="Підписка → пільгова" sub="у таблиці статус «Пільговий»" c={c} mgrShadowId={managerShadowId} />
              <Activity cx={1150} cy={642} w={180} num={17} kind="email"    title="Лист пільгового періоду" sub="разова→продовжено · авто→не списав" editLocation="Листи Нагадування" c={c} mgrShadowId={managerShadowId} />

              {/* 6 · ЗАКРИТТЯ ДОСТУПУ */}
              <Activity cx={1345} cy={194} w={180} num={18} kind="wfp"      title="Вимикається автосписання" sub="більше не списує з картки" c={c} mgrShadowId={managerShadowId} />
              <Activity cx={1345} cy={290} w={180} num={19} kind="platform" title="Підписка закривається" sub="у таблиці статус «Закрита»" c={c} mgrShadowId={managerShadowId} />
              <Activity cx={1345} cy={482} w={180} num={20} kind="sp"       title="Закриває курс для студента" sub="матеріали стають недоступні" c={c} mgrShadowId={managerShadowId} />
              <Activity cx={1345} cy={642} w={180} num={21} kind="email"    title="Лист «Доступ закрито»" sub="повідомляємо студента" editLocation="Листи Нагадування" c={c} mgrShadowId={managerShadowId} />
            </svg>
          </div>

          {/* Легенда email-чіпа */}
          <div className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
            <span className="inline-flex items-center gap-1.5">
              <span className={`inline-block w-3 h-3 rounded ${dark ? 'bg-rose-400/30 border border-rose-400/40' : 'bg-rose-100 border border-rose-300'}`} />
              Email-бокс має чіп <strong className="font-semibold">📝 …</strong> — це назва кнопки в адмінці, де редагується шаблон листа.
            </span>
          </div>

          {/* ═══════════ КНОПКИ МЕНЕДЖЕРА ═══════════ */}
          <div className="mt-8">
            <div className="flex items-baseline gap-2 mb-1">
              <h4 className={`text-[14px] font-bold ${dark ? 'text-amber-200' : 'text-amber-900'}`}>
                🧑‍💼 Кнопки менеджера · де які
              </h4>
              <span className={`text-[11px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                всі золоті дії з діаграми + додаткові
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-3">
              <ButtonCard dark={dark} emoji="🚀" name="Запустити програму" where="у рядку запуску в таблиці" when="у день фактичного старту програми" what="відкриває доступ у SendPulse усім, хто оплатив, і за замовчуванням одразу шле welcome-лист (можна вимкнути в модалці)" primary />
              <ButtonCard dark={dark} emoji="✉️" name="Дослати лист" where="з'являється після запуску" when="якщо запуск був без листа — або потрібно повторно для конкретних людей" what="надсилає welcome тим, хто ще не отримав; або per-recipient resend; дублі виключено" />
              <ButtonCard dark={dark} emoji="🤖" name="Додати в Telegram канал" where="у toolbar Річної програми" when="одноразово — при налаштуванні програми" what="фіксує канал/групу + чекбокс «автододавання»: при оплаті система генерує одноразовий invite-link і вкладає його у welcome-лист" primary />
              <ButtonCard dark={dark} emoji="👤" name="Додати студента" where="у рядку запуску (видно після 🚀)" when="коли студент не встиг купити до старту" what="створює персональне посилання на оплату; після оплати — авто-відкриття доступу" primary />
              <ButtonCard dark={dark} emoji="🎯" name="Екстра запуск" where="у рядку конкретної підписки" when="для додано-вручну студента або того, хто оплатив пізно" what="вручну відкриває доступ і шле вітальний лист тільки одному студенту" />
              <ButtonCard dark={dark} emoji="🔁" name="Повторити запуск (N)" where="біля 🚀 (з'являється тільки при помилці)" when="якщо для частини підписок доступ не відкрився" what="повторно запустить тільки для тих, кому не вдалося — без дублів" />
              <ButtonCard dark={dark} emoji="🔄" name="Перенести в наступний запуск" where="у рядку підписки (тільки до запуску групи)" when="якщо студент хоче відкласти участь" what="міняє запуск підписки + перераховує дати доступу" />
            </div>
            <p className={`mt-3 text-[11.5px] ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
              <strong className={dark ? 'text-slate-200' : 'text-stone-900'}>Шаблони листів:</strong>&nbsp;
              <span>📝 кнопка <em>«Листи Нагадування»</em> (нагадування -3д/-1д, пільговий, закриття) · 📝 кнопка <em>«Листи Платежів»</em> (welcome, чек, plan-changed, admin-actions) — обидві у програмних налаштуваннях. Welcome-лист cohort-launch — у модалці кнопки 🚀.</span>
            </p>
          </div>

          {/* ═══════════ ОКРЕМІ СЦЕНАРІЇ ═══════════ */}
          <h4 className={`mt-7 mb-3 text-[11px] uppercase tracking-[0.2em] font-semibold ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
            Окремі сценарії
          </h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            <ScenarioCard dark={dark} c={c} emoji="🤖" title="Telegram-канал · auto-invite на оплаті" trigger="Налаштовано канал у toolbar + чекбокс «автододавання» ON + студент при оплаті дав свій @username" steps={[
              { who: 'student', what: 'оплачує програму, у формі вказує свій Telegram-username' },
              { who: 'wfp', what: 'callback → платіж зафіксовано' },
              { who: 'platform', what: 'перевіряє: autoAdd ON + chatId є + tgUsername є → так' },
              { who: 'tg', what: 'через Bot API генерує одноразовий invite-link для цього каналу' },
              { who: 'platform', what: 'зберігає посилання у subscription.telegramInviteLink' },
              { who: 'email', what: 'у лист про оплату (#5) і welcome-лист (#9) додається блок «Приєднатись до каналу»' },
              { who: 'student', what: 'клікає invite у листі → потрапляє в канал. Бот не пушить — студент сам приєднується' },
            ]} accent="sky" />
            <ScenarioCard dark={dark} c={c} emoji="🎯" title="Пізня оплата · auto-extra-launch" trigger="Студент оплатив ПІСЛЯ того, як група вже стартувала" steps={[
              { who: 'student', what: 'оплачує програму на сайті' },
              { who: 'wfp', what: 'передає сигнал про оплату на сайт' },
              { who: 'platform', what: 'бачить, що група вже стартувала, → запускає extra-launch автоматично' },
              { who: 'sp', what: 'відкриває курс одразу для цього студента' },
              { who: 'email', what: 'не welcome, а cohort launch email (з шаблону менеджера; TG-invite вкладено якщо autoAdd)' },
            ]} accent="sky" />
            <ScenarioCard dark={dark} c={c} emoji="✋" title="Ручне додавання · персональне посилання" trigger="Менеджер додає студента, що не встиг купити вчасно" steps={[
              { who: 'manager', what: 'натискає 👤 «Додати студента» — email + ім\'я' },
              { who: 'platform', what: 'створює персональне посилання (дійсне 7 днів)' },
              { who: 'manager', what: 'надсилає посилання студенту' },
              { who: 'student', what: 'переходить, форма вже заповнена, оплачує' },
              { who: 'platform', what: 'позначає «додано вручну». Якщо група запущена — auto extra-launch' },
            ]} accent="amber" />
            <ScenarioCard dark={dark} c={c} emoji="🔁" title="Повторити запуск" trigger="Частина підписок не отримала доступ при першому запуску" steps={[
              { who: 'platform', what: 'позначає, скільком студентам не вдалося відкрити доступ' },
              { who: 'manager', what: 'натискає 🔁 «Повторити запуск (N)»' },
              { who: 'platform', what: 'повторює тільки для тих, кому не вдалося — без дублів' },
              { who: 'sp', what: 'відкриває курс для решти студентів' },
              { who: 'platform', what: 'фіксує: кому доступ тепер відкрито' },
            ]} accent="amber" />
            <ScenarioCard dark={dark} c={c} emoji="💸" title="Невдале списання (cyclical)" trigger="WFP не зміг списати чергові 2 200 ₴ з картки (тільки автосписання)" steps={[
              { who: 'wfp', what: 'списання провалилось → сигнал на сайт' },
              { who: 'platform', what: 'failedChargeCount + 1, лог «charge failed»' },
              { who: 'platform', what: 'після expiresAt → підписка стає пільговою' },
              { who: 'email', what: 'наступного дня — «не вдалось списати оплату»' },
              { who: 'email', what: 'через 3 дні в grace — «залишилось N днів до закриття»' },
              { who: 'platform', what: 'якщо за 7 днів не вдалося — закриття + лист «Доступ закрито»' },
            ]} accent="rose" />
            <ScenarioCard dark={dark} c={c} emoji="🔄" title="Зміна плану (upgrade/downgrade)" trigger="Студент переходить між «авто» і «разовою» між платежами" steps={[
              { who: 'student', what: 'оплачує наступний місяць іншим планом' },
              { who: 'wfp', what: 'callback на платформу' },
              { who: 'platform', what: 'detect: autorenew_upgraded або autorenew_downgraded' },
              { who: 'wfp', what: 'якщо downgrade — REMOVE автосписання' },
              { who: 'email', what: 'plan-changed-upgrade або plan-changed-downgrade' },
            ]} accent="violet" />
            <ScenarioCard dark={dark} c={c} emoji="❌" title="Скасування авто-плану" trigger="ТІЛЬКИ для Monthly з автосписанням (auto-renew=true)" steps={[
              { who: 'manager', what: 'у рядку підписки — кнопка «Скасувати»' },
              { who: 'platform', what: 'статус → «Скасована», cancelledAt + cancelledBy' },
              { who: 'wfp', what: 'REMOVE усіх регулярних списань' },
              { who: 'sp', what: 'доступ зберігається до кінця сплаченого періоду' },
              { who: 'email', what: 'admin-cancelled (за шаблоном)' },
            ]} accent="rose" />
            <ScenarioCard dark={dark} c={c} emoji="🔒" title="Адмін: закрити доступ зараз" trigger="Менеджер хоче закрити доступ ДО природного завершення" steps={[
              { who: 'manager', what: 'у рядку підписки — кнопка «Закрити доступ»' },
              { who: 'sp', what: 'DELETE студента з курсу одразу' },
              { who: 'wfp', what: 'REMOVE автосписання (якщо було)' },
              { who: 'platform', what: 'статус → «Закрита». Можна реактивувати' },
              { who: 'email', what: 'admin-access-closed' },
            ]} accent="amber" />
            <ScenarioCard dark={dark} c={c} emoji="🗑️" title="Адмін: архівувати" trigger="Soft-delete підписки (без можливості реактивації)" steps={[
              { who: 'manager', what: 'у рядку підписки — кнопка «Видалити»' },
              { who: 'sp', what: 'DELETE студента з курсу' },
              { who: 'wfp', what: 'REMOVE автосписання' },
              { who: 'platform', what: 'статус → «Архівована», sendpulseStudentId очищено' },
              { who: 'email', what: 'admin-archived' },
            ]} accent="rose" />
          </div>

          {/* ═══════════ ПОРІВНЯЛЬНА ТАБЛИЦЯ ПЛАНІВ ═══════════ */}
          <h4 className={`mt-7 mb-3 text-[11px] uppercase tracking-[0.2em] font-semibold ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
            Що відрізняється за типом плану
          </h4>
          <div className={`rounded-xl border overflow-hidden ${dark ? 'border-white/10' : 'border-stone-200'}`}>
            <table className="w-full text-[11.5px]">
              <thead className={dark ? 'bg-white/[0.03]' : 'bg-stone-100/60'}>
                <tr>
                  <th className={`text-left px-4 py-2.5 font-semibold ${dark ? 'text-slate-400' : 'text-stone-600'}`}>Параметр</th>
                  <th className={`text-left px-4 py-2.5 font-semibold ${dark ? 'text-blue-300' : 'text-blue-800'}`}>🔵 Річна</th>
                  <th className={`text-left px-4 py-2.5 font-semibold ${dark ? 'text-emerald-300' : 'text-emerald-800'}`}>🟢 Місячна авто</th>
                  <th className={`text-left px-4 py-2.5 font-semibold ${dark ? 'text-amber-300' : 'text-amber-800'}`}>🟡 Місячна разова</th>
                </tr>
              </thead>
              <tbody className={dark ? 'text-slate-300' : 'text-stone-700'}>
                <PlanRow dark={dark} label="Ціна" yearly="15 000 ₴ разово" auto="2 200 ₴ × 9 = 19 800 ₴" manual="2 200 ₴ за місяць" />
                <PlanRow dark={dark} label="Доступ" yearly="до кінця cohort-у" auto="+30 днів за платіж" manual="+30 днів за платіж" />
                <PlanRow dark={dark} label="Кількість списань" yearly="1 разово" auto="до 9 авто-списань" manual="оплачує сам кожен раз" />
                <PlanRow dark={dark} label="Лист-чек після оплати" yearly="welcome (1 раз)" auto="за кожне списання" manual="за кожен платіж" />
                <PlanRow dark={dark} label="Нагадування −3д / −1д" yearly="—" auto="—" manual="✅ так" />
                <PlanRow dark={dark} label="Лист «не списали»" yearly="—" auto="✅ +1д у grace, +3д у grace" manual="—" />
                <PlanRow dark={dark} label="Кнопка «Скасувати»" yearly="—" auto="✅ є (вимикає автоплатеж)" manual="—" />
                <PlanRow dark={dark} label="Лист «Доступ закрито»" yearly="✅ після cohort.endDate + grace" auto="✅ після grace" manual="✅ після grace" />
              </tbody>
            </table>
          </div>

          {/* ═══════════ FOOTER NOTE ═══════════ */}
          <div className={`mt-6 rounded-lg border-l-4 px-4 py-3 ${dark ? 'bg-white/[0.02] border-amber-400/40' : 'bg-amber-50/40 border-amber-400'}`}>
            <p className={`text-[12px] leading-relaxed ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
              <strong className={dark ? 'text-slate-200' : 'text-stone-900'}>Місячний з автосписанням:</strong> якщо WayForPay не зміг списати з карти — наступного дня студенту йде лист «не вдалося списати», ще через 3 дні — другий лист, далі підписка переходить у пільговий період і потім закривається.&nbsp;
              <strong className={dark ? 'text-slate-200' : 'text-stone-900'}>Місячний разовий (без автосписання):</strong> ті ж самі нагадування, але платіж не намагається списатися автоматично — студент має оплатити сам.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─────────────────────── COLORS ───────────────────────

type ActorPalette = {
  fill: string;
  stroke: string;
  text: string;
  subText: string;
  badgeFill: string;
  badgeText: string;
  laneBg: string;
  laneHeaderBg: string;
};

type Colors = {
  actor: Record<ActorKind, ActorPalette>;
  laneSep: string;
  phaseSep: string;
  phaseHeaderFill: string;
  phaseHeaderText: string;
  edgeStroke: string;
  edgeAccent: string;
  edgeLabel: string;
  bg: string;
};

// Soft / premium palette — manager = золотий amber (1:1 з реальною кнопкою «Запустити програму»)
const lightColors: Colors = {
  actor: {
    student:  { fill: '#F0F9FF', stroke: '#BFDBFE', text: '#1E3A8A', subText: '#475569', badgeFill: '#60A5FA', badgeText: '#FFFFFF', laneBg: '#FAFCFF', laneHeaderBg: '#EFF6FF' },
    wfp:      { fill: '#FAF5FF', stroke: '#E9D5FF', text: '#5B21B6', subText: '#475569', badgeFill: '#A78BFA', badgeText: '#FFFFFF', laneBg: '#FCFAFF', laneHeaderBg: '#F5F3FF' },
    platform: { fill: '#F8FAFC', stroke: '#E2E8F0', text: '#334155', subText: '#64748B', badgeFill: '#94A3B8', badgeText: '#FFFFFF', laneBg: '#FCFCFD', laneHeaderBg: '#F1F5F9' },
    manager:  { fill: '#FEF3C7', stroke: '#D4A843', text: '#78350F', subText: '#92400E', badgeFill: '#D97706', badgeText: '#FFFFFF', laneBg: '#FFFCF5', laneHeaderBg: '#FDE68A' },
    sp:       { fill: '#ECFDF5', stroke: '#BBF7D0', text: '#065F46', subText: '#475569', badgeFill: '#34D399', badgeText: '#FFFFFF', laneBg: '#F8FFFB', laneHeaderBg: '#D1FAE5' },
    tg:       { fill: '#ECFEFF', stroke: '#A5F3FC', text: '#155E75', subText: '#475569', badgeFill: '#06B6D4', badgeText: '#FFFFFF', laneBg: '#F8FEFF', laneHeaderBg: '#CFFAFE' },
    email:    { fill: '#FFF1F2', stroke: '#FECDD3', text: '#9F1239', subText: '#475569', badgeFill: '#FB7185', badgeText: '#FFFFFF', laneBg: '#FFFAFA', laneHeaderBg: '#FFE4E6' },
  },
  laneSep: '#E7E5E4',
  phaseSep: '#F5F5F4',
  phaseHeaderFill: '#FAFAF9',
  phaseHeaderText: '#57534E',
  edgeStroke: '#A8A29E',
  edgeAccent: '#78716C',
  edgeLabel: '#57534E',
  bg: '#FAFAF9',
};

const darkColors: Colors = {
  actor: {
    student:  { fill: 'rgba(96,165,250,0.10)', stroke: 'rgba(96,165,250,0.4)',  text: '#BFDBFE', subText: '#CBD5E1', badgeFill: '#60A5FA', badgeText: '#0F172A', laneBg: 'rgba(96,165,250,0.025)', laneHeaderBg: 'rgba(96,165,250,0.08)' },
    wfp:      { fill: 'rgba(167,139,250,0.10)',stroke: 'rgba(167,139,250,0.4)', text: '#DDD6FE', subText: '#CBD5E1', badgeFill: '#A78BFA', badgeText: '#0F172A', laneBg: 'rgba(167,139,250,0.025)',laneHeaderBg: 'rgba(167,139,250,0.08)' },
    platform: { fill: 'rgba(148,163,184,0.10)',stroke: 'rgba(148,163,184,0.35)',text: '#CBD5E1', subText: '#94A3B8', badgeFill: '#94A3B8', badgeText: '#0F172A', laneBg: 'rgba(148,163,184,0.025)',laneHeaderBg: 'rgba(148,163,184,0.08)' },
    manager:  { fill: 'rgba(251,191,36,0.20)', stroke: 'rgba(212,168,67,0.85)', text: '#FDE68A', subText: '#FCD34D', badgeFill: '#D97706', badgeText: '#FFFFFF', laneBg: 'rgba(251,191,36,0.04)',  laneHeaderBg: 'rgba(251,191,36,0.13)' },
    sp:       { fill: 'rgba(110,231,183,0.10)',stroke: 'rgba(110,231,183,0.4)', text: '#A7F3D0', subText: '#CBD5E1', badgeFill: '#34D399', badgeText: '#0F172A', laneBg: 'rgba(110,231,183,0.025)',laneHeaderBg: 'rgba(110,231,183,0.08)' },
    tg:       { fill: 'rgba(34,211,238,0.10)', stroke: 'rgba(34,211,238,0.4)',  text: '#A5F3FC', subText: '#CBD5E1', badgeFill: '#06B6D4', badgeText: '#0F172A', laneBg: 'rgba(34,211,238,0.025)', laneHeaderBg: 'rgba(34,211,238,0.08)' },
    email:    { fill: 'rgba(251,113,133,0.10)',stroke: 'rgba(251,113,133,0.4)', text: '#FECDD3', subText: '#CBD5E1', badgeFill: '#FB7185', badgeText: '#FFFFFF', laneBg: 'rgba(251,113,133,0.025)',laneHeaderBg: 'rgba(251,113,133,0.08)' },
  },
  laneSep: 'rgba(255,255,255,0.06)',
  phaseSep: 'rgba(255,255,255,0.04)',
  phaseHeaderFill: 'rgba(255,255,255,0.02)',
  phaseHeaderText: '#A8A29E',
  edgeStroke: '#78716C',
  edgeAccent: '#A8A29E',
  edgeLabel: '#CBD5E1',
  bg: '#18181B',
};

// ─────────────────────── COMPONENTS ───────────────────────

function Edge({ d, c, arrowId, dashed = false, accent = false }: { d: string; c: Colors; arrowId: string; dashed?: boolean; accent?: boolean }) {
  return (
    <path
      d={d}
      fill="none"
      stroke={accent ? c.edgeAccent : c.edgeStroke}
      strokeWidth={accent ? 2 : 1.5}
      strokeDasharray={dashed ? '4 3' : undefined}
      markerEnd={`url(#${arrowId})`}
    />
  );
}

function NumberBadge({ x, y, num, palette }: { x: number; y: number; num: number; palette: ActorPalette }) {
  return (
    <g>
      <circle cx={x} cy={y} r={9.5} fill={palette.badgeFill} />
      <text
        x={x}
        y={y + 0.5}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={10.5}
        fontWeight={800}
        fill={palette.badgeText}
        style={{ fontFamily: 'inherit' }}
      >
        {num}
      </text>
    </g>
  );
}

function Activity({
  cx, cy, w, num, kind, title, sub, editLocation, c, mgrShadowId,
}: {
  cx: number; cy: number; w: number;
  num: number;
  kind: ActorKind;
  title: string; sub?: string;
  editLocation?: string;
  c: Colors;
  mgrShadowId: string;
}) {
  const isMgr = kind === 'manager';
  const palette = c.actor[kind];
  const h = boxH(kind, isMgr);
  const x = cx - w / 2;
  const y = cy - h / 2;
  const isEmail = kind === 'email';

  return (
    <g>
      {/* Manager-action "ВАША ДІЯ" pill */}
      {isMgr && (
        <g>
          <rect x={cx + w / 2 - 86} y={y - 13} width={82} height={12} rx={6} fill={palette.badgeFill} />
          <text
            x={cx + w / 2 - 45}
            y={y - 6.5}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={8}
            fontWeight={700}
            letterSpacing={0.5}
            fill="#FFFFFF"
            style={{ fontFamily: 'inherit' }}
          >
            👆 ВАША ДІЯ
          </text>
        </g>
      )}

      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={isMgr ? 12 : 9}
        ry={isMgr ? 12 : 9}
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth={isMgr ? 2 : 1}
        filter={isMgr ? `url(#${mgrShadowId})` : undefined}
      />

      <NumberBadge x={x + 14} y={y + 14} num={num} palette={palette} />

      <text
        x={cx + 8}
        y={isEmail ? y + 24 : (cy - (sub ? 9 : 0))}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={isMgr ? 12.5 : 11.5}
        fontWeight={isMgr ? 800 : 700}
        fill={palette.text}
        style={{ fontFamily: 'inherit' }}
      >
        {title}
      </text>
      {sub && (
        <text
          x={cx + 8}
          y={isEmail ? y + 41 : (cy + 10)}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10}
          fontStyle={isMgr ? 'italic' : 'normal'}
          fontWeight={500}
          fill={palette.subText}
          style={{ fontFamily: 'inherit' }}
        >
          {sub}
        </text>
      )}
      {/* Email edit-source chip — назва кнопки в адмінці, де редагується шаблон */}
      {editLocation && isEmail && (
        <g>
          <rect
            x={x + 14}
            y={y + h - 19}
            width={w - 28}
            height={14}
            rx={4}
            fill={palette.badgeFill}
            opacity={0.18}
            stroke={palette.stroke}
            strokeWidth={0.5}
          />
          <text
            x={cx + 8}
            y={y + h - 12}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={9}
            fontWeight={700}
            fill={palette.text}
            letterSpacing={0.2}
            style={{ fontFamily: 'inherit' }}
          >
            📝 {editLocation}
          </text>
        </g>
      )}
    </g>
  );
}

function PlanBox({
  cx, cy, w, h, num, c, title, plans,
}: {
  cx: number; cy: number; w: number; h: number;
  num: number;
  c: Colors;
  title: string;
  plans: { color: string; label: string; price: string }[];
}) {
  const palette = c.actor.student;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const planRowStart = y + 38;
  const planRowH = 16;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={9}
        ry={9}
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth={1}
      />

      <NumberBadge x={x + 14} y={y + 14} num={num} palette={palette} />

      <text
        x={cx + 8}
        y={y + 18}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={12}
        fontWeight={800}
        fill={palette.text}
        style={{ fontFamily: 'inherit' }}
      >
        {title}
      </text>

      {plans.map((p, i) => {
        const rowY = planRowStart + i * planRowH;
        return (
          <g key={i}>
            <circle cx={x + 16} cy={rowY} r={4} fill={p.color} />
            <text
              x={x + 26}
              y={rowY + 0.5}
              dominantBaseline="middle"
              fontSize={9.5}
              fontWeight={700}
              fill={palette.text}
              style={{ fontFamily: 'inherit' }}
            >
              {p.label}
            </text>
            <text
              x={x + w - 10}
              y={rowY + 0.5}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={9.5}
              fontWeight={500}
              fill={palette.subText}
              style={{ fontFamily: 'inherit' }}
            >
              {p.price}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ─────────────────────── BUTTON CARD ───────────────────────

function ButtonCard({
  dark, emoji, name, where, when, what, primary = false,
}: {
  dark: boolean;
  emoji: string;
  name: string;
  where: string;
  when: string;
  what: string;
  primary?: boolean;
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${
      primary
        ? dark ? 'bg-amber-500/[0.08] border-amber-400/40' : 'bg-amber-50 border-amber-200'
        : dark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-stone-200'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${
          dark ? 'bg-amber-500/25 text-amber-100 border border-amber-400/50' : 'bg-amber-100 text-amber-900 border border-amber-300'
        }`}>
          {emoji}
        </span>
        <h5 className={`text-[13px] font-bold leading-tight ${dark ? 'text-amber-100' : 'text-amber-900'}`}>{name}</h5>
      </div>
      <dl className="space-y-1.5 text-[11.5px] leading-snug">
        <div className="flex gap-1.5">
          <dt className={`font-mono uppercase text-[9px] tracking-wider mt-[3px] flex-shrink-0 w-12 ${dark ? 'text-amber-300/70' : 'text-amber-700/70'}`}>Де</dt>
          <dd className={dark ? 'text-slate-300' : 'text-stone-700'}>{where}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className={`font-mono uppercase text-[9px] tracking-wider mt-[3px] flex-shrink-0 w-12 ${dark ? 'text-amber-300/70' : 'text-amber-700/70'}`}>Коли</dt>
          <dd className={dark ? 'text-slate-300' : 'text-stone-700'}>{when}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className={`font-mono uppercase text-[9px] tracking-wider mt-[3px] flex-shrink-0 w-12 ${dark ? 'text-amber-300/70' : 'text-amber-700/70'}`}>Що</dt>
          <dd className={dark ? 'text-slate-300' : 'text-stone-700'}>{what}</dd>
        </div>
      </dl>
    </div>
  );
}

// ─────────────────────── SCENARIO CARD ───────────────────────

function ScenarioCard({
  dark, c, emoji, title, trigger, steps, accent,
}: {
  dark: boolean;
  c: Colors;
  emoji: string;
  title: string;
  trigger: string;
  steps: { who: ActorKind | string; what: string }[];
  accent: 'sky' | 'orange' | 'rose' | 'amber' | 'violet';
}) {
  const accentMap = {
    sky:    { light: 'border-sky-200 bg-sky-50/50',         dark: 'border-sky-400/25 bg-sky-500/[0.05]' },
    orange: { light: 'border-orange-200 bg-orange-50/50',   dark: 'border-orange-400/25 bg-orange-500/[0.05]' },
    rose:   { light: 'border-rose-200 bg-rose-50/50',       dark: 'border-rose-400/25 bg-rose-500/[0.05]' },
    amber:  { light: 'border-amber-200 bg-amber-50/50',     dark: 'border-amber-400/25 bg-amber-500/[0.05]' },
    violet: { light: 'border-violet-200 bg-violet-50/50',   dark: 'border-violet-400/25 bg-violet-500/[0.05]' },
  };
  const a = accentMap[accent];

  const actorLabels: Record<ActorKind, { label: string; emoji: string }> = {
    student:  { label: 'Студент',     emoji: '👤' },
    wfp:      { label: 'WayForPay',   emoji: '💳' },
    platform: { label: 'Наш сайт',    emoji: '⚙️' },
    manager:  { label: 'Менеджер',    emoji: '🧑‍💼' },
    sp:       { label: 'SendPulse',   emoji: '🎓' },
    tg:       { label: 'Telegram',    emoji: '🤖' },
    email:    { label: 'Email',       emoji: '✉️' },
  };

  return (
    <div className={`rounded-xl border px-4 py-3.5 ${dark ? a.dark : a.light}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[18px] leading-none">{emoji}</span>
        <h5 className={`text-[12.5px] font-bold leading-tight ${dark ? 'text-slate-100' : 'text-stone-900'}`}>{title}</h5>
      </div>
      <p className={`text-[11px] italic leading-relaxed mb-2.5 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>{trigger}</p>
      <ol className="space-y-1.5">
        {steps.map((s, i) => {
          const actor = (s.who in actorLabels) ? actorLabels[s.who as ActorKind] : null;
          const palette = actor ? c.actor[s.who as ActorKind] : null;
          return (
            <li key={i} className="flex items-start gap-2">
              <span className={`mt-[2px] inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold flex-shrink-0 ${
                dark ? 'bg-white/10 text-slate-200' : 'bg-stone-200 text-stone-700'
              }`}>{i + 1}</span>
              <div className="text-[11.5px] leading-snug">
                {actor && palette ? (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono font-semibold text-[10px] mr-1"
                    style={{
                      backgroundColor: palette.fill,
                      color: palette.text,
                      border: `1px solid ${palette.stroke}`,
                    }}
                  >
                    {actor.emoji} {actor.label}
                  </span>
                ) : (
                  <span className={`font-mono font-semibold ${dark ? 'text-slate-200' : 'text-stone-900'}`}>{String(s.who)}</span>
                )}
                <span className={dark ? 'text-slate-400' : 'text-stone-700'}> {s.what}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─────────────────────── PLAN COMPARISON TABLE ───────────────────────

function PlanRow({
  dark, label, yearly, auto, manual,
}: {
  dark: boolean;
  label: string;
  yearly: string;
  auto: string;
  manual: string;
}) {
  return (
    <tr className={`border-t ${dark ? 'border-white/[0.05]' : 'border-stone-200/70'}`}>
      <td className={`px-4 py-2 font-semibold ${dark ? 'text-slate-200' : 'text-stone-900'}`}>{label}</td>
      <td className="px-4 py-2">{yearly}</td>
      <td className="px-4 py-2">{auto}</td>
      <td className="px-4 py-2">{manual}</td>
    </tr>
  );
}
