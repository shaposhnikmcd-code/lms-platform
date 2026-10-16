/// Яку дію робити в SendPulse при закритті/відкритті доступу до Річної програми.
/// Чисті функції без БД і мережі — тести: `npm run test:spaccess`.
///
/// Чому так: DELETE /students/{id}/{courseId} стирає студента з курсу разом із домашніми
/// завданнями. Тому «закриття за несплату» і «Закрити доступ» менеджера йдуть подією
/// `yearly-program-close` (воронка: «Змінити обмеження часу → Закрити доступ», прогрес
/// лишається). Хто закритий так, той досі на курсі — повертати його треба подією
/// `yearly-program-reopen` («Без обмежень»), а не повторною реєстрацією.
/// DELETE лишається лише там, де видалення свідоме: «Видалити» і повний рефанд.

/// Хто просить дію.
export type SpAccessTrigger =
  | 'cron_expire' // cron GRACE → EXPIRED
  | 'close_access' // кнопка «Закрити доступ»
  | 'delete' // кнопка «Видалити» (архів)
  | 'full_refund' // повний рефанд у WFP-callback-у
  | 'open'; // будь-яке відкриття: «Відкрити знову», запуск, екстра-запуск, heal

export type SpAccessAction = 'close_event' | 'delete' | 'reopen_event' | 'open_event';

/// Стан студента в курсі SP за журналом подій підписки.
/// `closed_by_event` — останнє, що ми робили з доступом, — закриття подією: студент на курсі,
/// але з закритим обмеженням часу. `removed` — видалений DELETE-ом. `open` — доступ відкривали
/// після останнього закриття. `none` — жодних слідів у журналі.
export type SpCourseState = 'closed_by_event' | 'removed' | 'open' | 'none';

/// Значення `metadata.spCloseMethod` у події `access_closed`, коли закрито подією воронки.
/// Старі `access_closed` без цього поля — це DELETE (до цієї зміни інших закриттів не було).
export const SP_CLOSE_METHOD_EVENT = 'event';

export type SpJournalEvent = {
  type: string;
  metadata: unknown;
  createdAt: Date | string;
};

/// Типи подій, з яких складається стан — їх і треба вибирати з БД.
export const SP_STATE_EVENT_TYPES = ['access_closed', 'admin_action', 'refunded', 'access_opened', 'reactivated'] as const;

function meta(e: SpJournalEvent): Record<string, unknown> {
  return e.metadata && typeof e.metadata === 'object' ? (e.metadata as Record<string, unknown>) : {};
}

/// Що каже ОДНА подія про стан у SP; null — подія про інше.
function stateOf(e: SpJournalEvent): SpCourseState | null {
  const m = meta(e);
  switch (e.type) {
    case 'access_closed':
      // Локальний EXPIRED без жодного виклику в SP — стан у SP не змінювався.
      if (m.spClosed === false) return null;
      return m.spCloseMethod === SP_CLOSE_METHOD_EVENT ? 'closed_by_event' : 'removed';
    case 'admin_action':
      // «Видалити» (архів) пише admin_action з sendpulseClosed=true — це DELETE.
      return m.sendpulseClosed === true ? 'removed' : null;
    case 'refunded':
      // Повний рефанд закриває підписку і видаляє з курсу DELETE-ом.
      return m.subscriptionClosed === true ? 'removed' : null;
    case 'access_opened':
    case 'reactivated':
      return 'open';
    default:
      return null;
  }
}

/// Стан за журналом: перша значуща подія від найновішої.
export function sendpulseCourseStateFromEvents(events: SpJournalEvent[]): SpCourseState {
  const sorted = [...events].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  for (const e of sorted) {
    const s = stateOf(e);
    if (s) return s;
  }
  return 'none';
}

/// Рішення: яку SP-дію виконати.
export function decideSendpulseAccessAction(
  trigger: SpAccessTrigger,
  state: SpCourseState = 'none',
): SpAccessAction {
  switch (trigger) {
    case 'cron_expire':
    case 'close_access':
      return 'close_event';
    case 'delete':
    case 'full_refund':
      return 'delete';
    case 'open':
      return state === 'closed_by_event' ? 'reopen_event' : 'open_event';
  }
}
