import { sendEmail, esc } from '@/lib/mailer';
import { getPaymentTemplate, renderTemplate } from '@/lib/emailTemplates/paymentTemplates';
import { kyivDateDisplay } from '@/lib/timezone';

/// Попередження «за кілька днів з картки спишеться N ₴» для MONTHLY-підписок з автоплатежем.
/// Шлеться нічним cron-ом (крок `autopay_precharge_notice`) за `AUTOPAY_NOTICE_DAYS_BEFORE`
/// днів до дати з `wfpNextChargeAt` (кеш графіка WFP).
///
/// Навіщо, якщо WayForPay і сам шле «повідомлення про наступний платіж»: той лист —
/// технічний, з чужим брендингом і без жодного нашого контакту, тож для клієнта він
/// виглядає як спам від невідомого сервісу. Наш лист дає нормальний контекст (що це за
/// програма, за який це модуль набору) і канал зв'язку — edu@uimp.com.ua.
///
/// Текст зберігається у `EmailTemplate` (key='precharge-notice') і редагується з адмінки.

export async function sendYearlyProgramUpcomingChargeEmail(args: {
  to: string;
  name: string | null;
  amount: number;
  /// Дата найближчого списання (з кешу графіка WFP).
  chargeAt: Date;
  /// Абсолютний номер МОДУЛЯ набору, який покриє це списання, і скільки модулів усього
  /// («модуль 3 з 9») — null, якщо порахувати не вдалось (тоді рядок прогресу в лист
  /// просто не потрапляє). Номер абсолютний, а не «N-те моє списання»: сітка модулів у
  /// всіх студентів одна, і в пізнього покупця перше списання — це вже модуль 2 чи 3.
  chargeProgress: { current: number; total: number } | null;
}): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const { to, name, amount, chargeAt, chargeProgress } = args;

  const greeting = name && name.trim() ? `Доброго дня, ${esc(name.trim())}!` : 'Доброго дня!';
  // Київський календар, а не UTC. `wfpNextChargeAt` — це `nextPaymentDate` з regularApi
  // (unix-секунди); WayForPay — український сервіс і день списання «05.10» віддає як
  // київську північ, тобто 04.10 21:00Z (взимку 22:00Z). `getUTCDate()` друкував би
  // «04.10» — на добу раніше, ніж спишуть. Київське форматування дає «05.10» і для
  // київської півночі, і для UTC-півночі (= 03:00 Київ того ж дня), тож не залежить від
  // того, як саме WFP закодує дату. Так само форматуються всі інші дати в листах Річної
  // (`dateOfVar` → `kyivDateDisplay`).
  const chargeDate = kyivDateDisplay(chargeAt);
  const progressLine = chargeProgress
    ? `<p style="margin: 0 0 16px; color: #555;">Це оплата модуля ${chargeProgress.current} з ${chargeProgress.total}.</p>`
    : '';

  const tpl = await getPaymentTemplate('precharge-notice');
  const vars = {
    greeting,
    amount: esc(String(amount)),
    chargeDate: esc(chargeDate),
    progressLine,
  };

  return sendEmail({
    to,
    subject: renderTemplate(tpl.subject, vars),
    html: renderTemplate(tpl.bodyHtml, vars),
    replyTo: 'edu@uimp.com.ua',
  });
}
