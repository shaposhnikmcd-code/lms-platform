/// Чистка підписок-сиріт Річної: статус у «оплаченому» стані (ACTIVE/GRACE/EXPIRED/
/// CANCELLED), але БЕЗ жодного PAID-платежу. Нормальна підписка такого стану без оплати
/// мати не може — це аномалія цілісності (зазвичай тестовий залишок, у якого активуючий
/// платіж було видалено). PENDING сюди НЕ входить (відсутність оплати там нормальна —
/// це незавершений чекаут, його окремо архівує cron).
///
/// За дефолтом DRY-RUN. Виконання: node scripts/cleanup-orphan-yearly-subs.mjs --execute
/// Б'є у ПРОД (.env). Перед видаленням: відкликає невикористаний TG-invite, зносить
/// сертифікати/платежі/підписку (events+dismissals — Cascade FK). Реальні клієнти
/// (є PAID-платіж) фізично не потрапляють у вибірку.
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env.local') }); // TELEGRAM_* (best-effort revoke)
config({ path: resolve(root, '.env'), override: true }); // ПРОД DB + TELEGRAM_* fallback

const host = (process.env.DATABASE_URL || '').match(/@([^/?]+)/)?.[1] || '?';
console.log(`\n=== TARGET DB: ${host} ===`);
if (!host.includes('ep-odd-night-alip82dn')) {
  console.error('❌ Очікувався прод host ep-odd-night-alip82dn. Перерви.');
  process.exit(1);
}
const EXECUTE = process.argv.includes('--execute');
console.log(EXECUTE ? '⚠️  EXECUTE MODE\n' : '🔍 DRY-RUN (додай --execute для видалення)\n');

const prisma = new PrismaClient();
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function revokeInvite(chatId, link) {
  if (!TG_TOKEN || !chatId || !link) return 'skip (нема токена/чату/лінка)';
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/revokeChatInviteLink`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, invite_link: link }),
    });
    const d = await r.json();
    return d.ok ? 'revoked' : `fail: ${d.description}`;
  } catch (e) { return `error: ${e.message}`; }
}

async function main() {
  const orphans = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'GRACE', 'EXPIRED', 'CANCELLED'] },
      payments: { none: { status: 'PAID' } },
    },
    select: {
      id: true, status: true, plan: true, autoRenew: true, telegramInviteLink: true,
      wfpRegularRef: true, sendpulseAccessOpenedAt: true,
      user: { select: { email: true, name: true } },
      payments: { select: { status: true, amount: true } },
    },
  });

  console.log(`Знайдено сиріт: ${orphans.length}\n`);
  if (!orphans.length) { console.log('Нічого видаляти.'); return; }

  const settings = await prisma.yearlyProgramTelegramSetting.findUnique({ where: { id: 'singleton' } });
  const chatId = settings?.chatId ?? null;

  for (const o of orphans) {
    const pays = o.payments.map((p) => `${p.status}:${p.amount}`).join(', ') || '—';
    console.log(`• ${o.status} ${o.plan}${o.autoRenew ? '+auto' : ''}  ${o.user?.name} <${o.user?.email}>  [${pays}]`);
    // Захист: подвійна перевірка — жодного PAID. Сюди не має потрапити реальний клієнт.
    if (o.wfpRegularRef) console.log(`    ⚠️ має wfpRegularRef=${o.wfpRegularRef} — після видалення перевір WFP-регуляр вручну`);
    if (o.sendpulseAccessOpenedAt) console.log('    ⚠️ має відкритий SendPulse-доступ — перевір вручну');

    if (!EXECUTE) {
      console.log(`    [dry-run] invite revoke + delete certs/payments/subscription`);
      continue;
    }

    const inv = await revokeInvite(chatId, o.telegramInviteLink);
    console.log(`    TG invite: ${inv}`);
    await prisma.$transaction(async (tx) => {
      await tx.certificate.deleteMany({ where: { subscriptionId: o.id } });
      await tx.payment.deleteMany({ where: { yearlyProgramSubscriptionId: o.id } });
      await tx.yearlyProgramSubscription.delete({ where: { id: o.id } });
    });
    console.log('    ✅ видалено (sub + payments + certs; events/dismissals — cascade)');
  }

  if (!EXECUTE) console.log('\n🔍 DRY-RUN — нічого не видалено.');
  else console.log('\n✅ DONE.');
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());
