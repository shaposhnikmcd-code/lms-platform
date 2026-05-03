import prisma from '@/lib/prisma';

/// Реєстр транзакційних листів Річної програми + дефолтні subject/bodyHtml.
/// Кожен ключ — стабільний ідентифікатор, який збігається з `EmailTemplate.templateKey`
/// у БД. Менеджер може переписати subject/bodyHtml через адмінку — на цей момент
/// dynamic-DB-значення replace дефолти. Якщо запис у БД відсутній — fallback на дефолт
/// з коду, тож код продовжує працювати навіть до першого редагування.
///
/// Placeholder-и виду `{name}`, `{plan}`, `{expiresAt}` підставляються у момент
/// відправки через `renderTemplate()`. Список доступних placeholder-ів і sample-data
/// визначені тут — UI використовує їх для прев'ю.

export type PaymentTemplateKey =
  | 'welcome'
  | 'plan-changed-upgrade'
  | 'plan-changed-downgrade'
  | 'receipt-autopay'
  | 'receipt-one-time'
  | 'admin-cancelled'
  | 'admin-archived'
  | 'admin-access-closed';

export type PaymentTemplateGroup = 'payment' | 'plan-change' | 'admin-end';

export interface PaymentTemplateMeta {
  key: PaymentTemplateKey;
  /// Логічна група для UI: payment / plan-change / admin-end.
  group: PaymentTemplateGroup;
  /// Назва для адмін-UI.
  title: string;
  /// Коли шлеться (для документації в UI).
  when: string;
  /// Список placeholder-ів, які доступні саме у цьому шаблоні (для підказки в UI).
  placeholders: string[];
  /// Sample-data для прев'ю — щоб менеджер бачив як виглядатиме лист.
  sampleData: Record<string, string>;
  /// Дефолти, до яких можна "Скинути".
  defaultSubject: string;
  defaultBodyHtml: string;
}

export const PAYMENT_TEMPLATE_GROUPS: { id: PaymentTemplateGroup; title: string; description: string }[] = [
  { id: 'payment', title: '💳 Оплата', description: 'Welcome на першу оплату + receipt на кожне успішне списання.' },
  { id: 'plan-change', title: '🔄 Зміна плану', description: 'Коли користувач переключається між разовою/автоплатежем.' },
  { id: 'admin-end', title: '🚪 Закриття менеджером', description: 'Коли менеджер скасовує/архівує/закриває доступ.' },
];

const layout = (innerHtml: string): string =>
  `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a; line-height: 1.6;">
${innerHtml}
  <p style="margin: 24px 0 0; color: #555;">Якщо є питання — пишіть на <a href="mailto:edu@uimp.com.ua" style="color: #b08d3f;">edu@uimp.com.ua</a>.</p>
  <p style="margin: 16px 0 0; color: #555;">— Команда Українського інституту Душеопіки та Психотерапії (UIMP)</p>
</div>
`.trim();

export const PAYMENT_TEMPLATES: Record<PaymentTemplateKey, PaymentTemplateMeta> = {
  'welcome': {
    key: 'welcome',
    group: 'payment',
    title: '🎓 Welcome — перша оплата',
    when: 'Перша оплата YEARLY або MONTHLY (wasFirstPayment=true). Без креденшилз — креденшилз видаються при launch cohort-у.',
    placeholders: ['greeting', 'plan', 'autoRenewBullet'],
    sampleData: {
      greeting: 'Доброго дня, Іван Петренко!',
      plan: 'Місячна оплата (одноразова)',
      autoRenewBullet: '',
    },
    defaultSubject: 'Вітаємо на Річній програмі — Український інститут Душеопіки та Психотерапії',
    defaultBodyHtml: layout(`  <h2 style="color: #1a1a1a; margin: 0 0 16px;">Вітаємо на Річній програмі</h2>
  <p style="margin: 0 0 12px;">{greeting}</p>
  <p style="margin: 0 0 16px;">Дякуємо за оплату — ваше місце на Річній програмі навчання Українського інституту Душеопіки та Психотерапії (UIMP) закріплене.</p>
  <p style="margin: 0 0 16px;"><b>Ваш план:</b> {plan}</p>
  <h3 style="margin: 24px 0 8px;">Що далі</h3>
  <ul style="margin: 0 0 16px; padding-left: 20px;">
    <li style="margin-bottom: 8px;">Ми готуємо запуск програми. <b>Перед початком навчання</b> ви отримаєте окремий лист з вашими доступами до навчальної платформи (логін і пароль).</li>
    {autoRenewBullet}
  </ul>`),
  },
  'plan-changed-upgrade': {
    key: 'plan-changed-upgrade',
    group: 'plan-change',
    title: '⬆ Plan-changed — Upgrade на автоплатіж',
    when: 'Користувач переключився з MONTHLY-разова на MONTHLY-автоплатіж через нову оплату.',
    placeholders: ['greeting', 'expiresLine'],
    sampleData: {
      greeting: 'Доброго дня, Іван Петренко!',
      expiresLine: '<p style="margin: 0 0 16px;"><b>Доступ діє до:</b> 2026-07-16</p>',
    },
    defaultSubject: 'Ваш план змінено — автосписання ввімкнено',
    defaultBodyHtml: layout(`  <h2 style="color: #1a1a1a; margin: 0 0 16px;">Ваш план оновлено</h2>
  <p style="margin: 0 0 12px;">{greeting}</p>
  <p style="margin: 0 0 16px;">Ваша підписка на Річну програму Українського інституту Душеопіки та Психотерапії (UIMP) успішно оновлена.</p>
  <p style="margin: 0 0 16px;"><b>Новий план:</b> Місячний план з автосписанням</p>
  {expiresLine}
  <h3 style="margin: 24px 0 8px;">Що це означає</h3>
  <ul style="margin: 0 0 16px; padding-left: 20px;">
    <li style="margin-bottom: 8px;">Наступні платежі будуть стягуватись автоматично щомісяця з тієї ж картки.</li>
    <li style="margin-bottom: 8px;">Кожне успішне списання продовжує доступ ще на місяць.</li>
    <li style="margin-bottom: 8px;">Скасувати автосписання можна у будь-який момент — напишіть на <a href="mailto:edu@uimp.com.ua" style="color: #b08d3f;">edu@uimp.com.ua</a>.</li>
  </ul>`),
  },
  'plan-changed-downgrade': {
    key: 'plan-changed-downgrade',
    group: 'plan-change',
    title: '⬇ Plan-changed — Downgrade на разову',
    when: 'Користувач переключився з MONTHLY-автоплатіж на MONTHLY-разова. У поточних бізнес-правилах це шлях рідкісний (Rule 2 блокує autoRenew=true → разова, треба спочатку cancel autopay).',
    placeholders: ['greeting', 'expiresLine'],
    sampleData: {
      greeting: 'Доброго дня, Іван Петренко!',
      expiresLine: '<p style="margin: 0 0 16px;"><b>Доступ діє до:</b> 2026-07-16</p>',
    },
    defaultSubject: 'Ваш план змінено — автосписання вимкнено',
    defaultBodyHtml: layout(`  <h2 style="color: #1a1a1a; margin: 0 0 16px;">Ваш план оновлено</h2>
  <p style="margin: 0 0 12px;">{greeting}</p>
  <p style="margin: 0 0 16px;">Ваша підписка на Річну програму Українського інституту Душеопіки та Психотерапії (UIMP) успішно оновлена.</p>
  <p style="margin: 0 0 16px;"><b>Новий план:</b> Місячна оплата (одноразова)</p>
  {expiresLine}
  <h3 style="margin: 24px 0 8px;">Що це означає</h3>
  <ul style="margin: 0 0 16px; padding-left: 20px;">
    <li style="margin-bottom: 8px;">Автосписання вимкнено — наступні платежі не будуть стягуватись автоматично.</li>
    <li style="margin-bottom: 8px;">Поточний місяць доступу залишається активним до вказаної дати.</li>
    <li style="margin-bottom: 8px;">Щоб продовжити навчання — оформте нову оплату на сайті, або поверніться до автосписання.</li>
  </ul>`),
  },
  'receipt-autopay': {
    key: 'receipt-autopay',
    group: 'payment',
    title: '🧾 Receipt — Автосписання',
    when: 'Кожне successful автосписання MONTHLY autoRenew=true (окрім першої оплати = welcome).',
    placeholders: ['greeting', 'amount', 'expiresAt', 'progressLine'],
    sampleData: {
      greeting: 'Доброго дня, Іван Петренко!',
      amount: '2200',
      expiresAt: '2026-08-15',
      progressLine: '<p style="margin: 0 0 16px; color: #555;">Списання 3 з 9.</p>',
    },
    defaultSubject: 'Автосписання по Річній програмі — {amount} ₴',
    defaultBodyHtml: layout(`  <h2 style="color: #1a1a1a; margin: 0 0 16px;">Дякуємо за оплату</h2>
  <p style="margin: 0 0 12px;">{greeting}</p>
  <p style="margin: 0 0 16px;">Платіж по Річній програмі Українського інституту Душеопіки та Психотерапії (UIMP) успішно проведено.</p>
  <p style="margin: 0 0 8px;"><b>Сума:</b> {amount} ₴</p>
  <p style="margin: 0 0 8px;"><b>План:</b> Місячний план з автосписанням</p>
  <p style="margin: 0 0 8px;"><b>Доступ продовжено до:</b> {expiresAt}</p>
  {progressLine}
  <h3 style="margin: 24px 0 8px;">Що далі</h3>
  <ul style="margin: 0 0 16px; padding-left: 20px;">
    <li style="margin-bottom: 8px;">Наступне списання пройде автоматично через місяць.</li>
    <li style="margin-bottom: 8px;">Скасувати автосписання можна у будь-який момент — напишіть на <a href="mailto:edu@uimp.com.ua" style="color: #b08d3f;">edu@uimp.com.ua</a>.</li>
  </ul>`),
  },
  'receipt-one-time': {
    key: 'receipt-one-time',
    group: 'payment',
    title: '🧾 Receipt — Разова оплата (продовження)',
    when: 'Повторна MONTHLY-разова оплата (продовжує доступ ще на місяць). Не для першої оплати = welcome.',
    placeholders: ['greeting', 'amount', 'expiresAt'],
    sampleData: {
      greeting: 'Доброго дня, Іван Петренко!',
      amount: '2200',
      expiresAt: '2026-08-15',
    },
    defaultSubject: 'Оплата по Річній програмі — {amount} ₴',
    defaultBodyHtml: layout(`  <h2 style="color: #1a1a1a; margin: 0 0 16px;">Дякуємо за оплату</h2>
  <p style="margin: 0 0 12px;">{greeting}</p>
  <p style="margin: 0 0 16px;">Платіж по Річній програмі Українського інституту Душеопіки та Психотерапії (UIMP) успішно проведено.</p>
  <p style="margin: 0 0 8px;"><b>Сума:</b> {amount} ₴</p>
  <p style="margin: 0 0 8px;"><b>План:</b> Місячна оплата (одноразова)</p>
  <p style="margin: 0 0 16px;"><b>Доступ продовжено до:</b> {expiresAt}</p>
  <h3 style="margin: 24px 0 8px;">Що далі</h3>
  <ul style="margin: 0 0 16px; padding-left: 20px;">
    <li style="margin-bottom: 8px;">Щоб продовжити навчання наступного місяця — оформте нову оплату на сайті.</li>
  </ul>`),
  },
  'admin-cancelled': {
    key: 'admin-cancelled',
    group: 'admin-end',
    title: '🚫 Admin — Cancel (підписку скасовано)',
    when: 'Менеджер натиснув Cancel у адмінці. Доступ зберігається до expiresAt, autopay знято (якщо був).',
    placeholders: ['greeting', 'autoRenewBullet', 'expiresLine'],
    sampleData: {
      greeting: 'Доброго дня, Іван Петренко!',
      autoRenewBullet: '<li style="margin-bottom: 8px;">Автосписання вимкнено — наступні платежі не будуть стягуватись.</li>',
      expiresLine: '<li style="margin-bottom: 8px;">Доступ до навчальної платформи зберігається до <b>2026-07-16</b>.</li>',
    },
    defaultSubject: 'Підписку на Річну програму скасовано',
    defaultBodyHtml: layout(`  <h2 style="color: #1a1a1a; margin: 0 0 16px;">Підписку скасовано</h2>
  <p style="margin: 0 0 12px;">{greeting}</p>
  <p style="margin: 0 0 16px;">Вашу підписку на Річну програму Українського інституту Душеопіки та Психотерапії (UIMP) скасовано.</p>
  <ul style="margin: 0 0 16px; padding-left: 20px;">
    {autoRenewBullet}
    {expiresLine}
    <li style="margin-bottom: 8px;">Якщо ви бажаєте продовжити навчання — напишіть на <a href="mailto:edu@uimp.com.ua" style="color: #b08d3f;">edu@uimp.com.ua</a>.</li>
  </ul>`),
  },
  'admin-archived': {
    key: 'admin-archived',
    group: 'admin-end',
    title: '🗑 Admin — Archive (доступ закрито незворотно)',
    when: 'Менеджер натиснув Архівувати у адмінці. SP-доступ закрито, autopay знято, відновити не можна.',
    placeholders: ['greeting', 'autoRenewBullet'],
    sampleData: {
      greeting: 'Доброго дня, Іван Петренко!',
      autoRenewBullet: '<li style="margin-bottom: 8px;">Автосписання вимкнено — наступні платежі не будуть стягуватись.</li>',
    },
    defaultSubject: 'Доступ до Річної програми закрито',
    defaultBodyHtml: layout(`  <h2 style="color: #1a1a1a; margin: 0 0 16px;">Доступ закрито</h2>
  <p style="margin: 0 0 12px;">{greeting}</p>
  <p style="margin: 0 0 16px;">Ваш доступ до Річної програми Українського інституту Душеопіки та Психотерапії (UIMP) закрито.</p>
  <ul style="margin: 0 0 16px; padding-left: 20px;">
    {autoRenewBullet}
    <li style="margin-bottom: 8px;">Якщо це сталось помилково — напишіть на <a href="mailto:edu@uimp.com.ua" style="color: #b08d3f;">edu@uimp.com.ua</a>.</li>
  </ul>`),
  },
  'admin-access-closed': {
    key: 'admin-access-closed',
    group: 'admin-end',
    title: '✕ Admin — Close access (доступ тимчасово закрито)',
    when: 'Менеджер натиснув Закрити доступ у SendPulse. Можна відновити через "Відкрити знову". Autopay знято.',
    placeholders: ['greeting', 'autoRenewBullet'],
    sampleData: {
      greeting: 'Доброго дня, Іван Петренко!',
      autoRenewBullet: '<li style="margin-bottom: 8px;">Автосписання вимкнено — наступні платежі не будуть стягуватись.</li>',
    },
    defaultSubject: 'Доступ до Річної програми закрито',
    defaultBodyHtml: layout(`  <h2 style="color: #1a1a1a; margin: 0 0 16px;">Доступ закрито</h2>
  <p style="margin: 0 0 12px;">{greeting}</p>
  <p style="margin: 0 0 16px;">Ваш доступ до Річної програми Українського інституту Душеопіки та Психотерапії (UIMP) закрито.</p>
  <ul style="margin: 0 0 16px; padding-left: 20px;">
    {autoRenewBullet}
    <li style="margin-bottom: 8px;">Якщо це сталось помилково або ви бажаєте відновити доступ — напишіть на <a href="mailto:edu@uimp.com.ua" style="color: #b08d3f;">edu@uimp.com.ua</a>.</li>
  </ul>`),
  },
};

/// Підставляє placeholder-и виду `{name}` значеннями з `vars`. Невідомі placeholder-и
/// замінюються на пустий рядок (а не на `{name}`), щоб лист не виглядав поламаним.
export function renderTemplate(template: string, vars: Record<string, string | null | undefined>): string {
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9_-]*)\}/g, (_, key: string) => {
    const value = vars[key];
    return value == null ? '' : String(value);
  });
}

/// Тягне шаблон з БД, fallback на дефолт із registry. Кешу немає — кожен виклик
/// = 1 SELECT, але це лише при відправці лиcта (рідко). Якщо стане bottleneck —
/// додамо in-memory cache з TTL.
export async function getPaymentTemplate(
  key: PaymentTemplateKey,
): Promise<{ subject: string; bodyHtml: string; isCustomized: boolean }> {
  const meta = PAYMENT_TEMPLATES[key];
  if (!meta) {
    throw new Error(`Unknown payment template key: ${key}`);
  }
  const row = await prisma.emailTemplate.findUnique({ where: { templateKey: key } });
  if (row) {
    return { subject: row.subject, bodyHtml: row.bodyHtml, isCustomized: true };
  }
  return { subject: meta.defaultSubject, bodyHtml: meta.defaultBodyHtml, isCustomized: false };
}
