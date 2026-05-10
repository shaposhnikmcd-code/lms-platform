import { sendEmail, esc } from '@/lib/mailer';
import { getPaymentTemplate, renderTemplate } from '@/lib/emailTemplates/paymentTemplates';
import prisma from '@/lib/prisma';

const SENDPULSE_LOGIN_URL = 'https://uimp-edu.sendpulse.online/courses/auth/login';

/// Підтвердження покупки пакета — шлемо один раз з callback-у WayForPay одразу
/// після першого Approved (claim.count > 0). Не залежить від SendPulse-воронки —
/// це гарантований канал, навіть якщо SP-event дедуплікований (студент уже має
/// курс із пакета на SP, тому SP не шле повторний welcome).
///
/// Скоуп: тільки bundle-payments (не курси, не yearly).
/// Шаблон редагований у адмінці (key='bundle-purchase').

export async function sendBundlePurchaseEmail(args: {
  to: string;
  name: string | null;
  bundleId: string;
  freeSlugs: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const { to, name, bundleId, freeSlugs } = args;

  const bundle = await prisma.bundle.findUnique({
    where: { id: bundleId },
    include: { courses: true },
  });
  if (!bundle) {
    return { ok: false, error: 'bundle_not_found' };
  }

  // Визначаємо які slug-и реально активні в покупці:
  // - DISCOUNT: всі courses з bundleCourse (всі платні)
  // - FIXED_FREE: всі courses з bundleCourse (paid + fixed free)
  // - CHOICE_FREE: paid + freeSlugs з Payment
  const activeSlugs: string[] = [];
  for (const bc of bundle.courses) {
    if (bundle.type === 'CHOICE_FREE') {
      if (!bc.isFree) activeSlugs.push(bc.courseSlug);
      else if (freeSlugs.includes(bc.courseSlug)) activeSlugs.push(bc.courseSlug);
    } else {
      activeSlugs.push(bc.courseSlug);
    }
  }

  const courses = await prisma.course.findMany({
    where: { slug: { in: activeSlugs } },
    select: { slug: true, title: true },
  });
  const titleBySlug = new Map(courses.map((c) => [c.slug, c.title]));
  const freeSet = new Set(
    bundle.courses.filter((bc) => bc.isFree).map((bc) => bc.courseSlug),
  );

  const items = activeSlugs
    .map((slug) => {
      const title = titleBySlug.get(slug) ?? slug;
      const giftLabel = freeSet.has(slug)
        ? ' <span style="color: #6b7280;">— у подарунок</span>'
        : '';
      return `<li style="margin-bottom: 6px;">${esc(title)}${giftLabel}</li>`;
    })
    .join('');
  const coursesList = `<ul style="margin: 0 0 16px; padding-left: 20px;">${items}</ul>`;

  const dashboardButton = `<p style="margin: 24px 0;"><a href="${SENDPULSE_LOGIN_URL}" style="display: inline-block; background: #b08d3f; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Перейти на платформу SendPulse</a></p>`;

  const greeting =
    name && name.trim() ? `Доброго дня, ${esc(name.trim())}!` : 'Доброго дня!';

  const tpl = await getPaymentTemplate('bundle-purchase');
  const vars = {
    greeting,
    bundleTitle: esc(bundle.title),
    coursesList,
    dashboardButton,
  };

  return sendEmail({
    to,
    subject: renderTemplate(tpl.subject, vars),
    html: renderTemplate(tpl.bodyHtml, vars),
    replyTo: 'edu@uimp.com.ua',
  });
}
