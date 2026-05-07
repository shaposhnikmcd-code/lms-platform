/// One-shot delete: прибираємо тестовий 1₴ запис студента (Polandemigrants@gmail.com)
/// який скрипт cleanup-test-payments.mjs пропустив через safety на STUDENT-роль.
/// За дефолтом dry-run, для реального видалення — `--execute`.

import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env'), override: true });

const prisma = new PrismaClient();
const EXECUTE = process.argv.includes('--execute');
const ORDER_REF = 'yearly-program-monthly_1778092810050_54232c77';

async function main() {
  const payment = await prisma.payment.findUnique({
    where: { orderReference: ORDER_REF },
    select: { id: true, amount: true, yearlyProgramSubscriptionId: true, user: { select: { email: true } } },
  });
  if (!payment) {
    console.log('❌ Payment не знайдено — можливо вже видалений');
    return;
  }
  console.log(`📦 Payment: ${ORDER_REF} | ${payment.amount}₴ | user=${payment.user.email}`);
  console.log(`📦 Subscription: ${payment.yearlyProgramSubscriptionId}`);

  if (!EXECUTE) {
    console.log('\n🔍 DRY-RUN. Для видалення додай --execute');
    return;
  }

  await prisma.$transaction(async (tx) => {
    const pDel = await tx.payment.delete({ where: { id: payment.id } });
    console.log(`✅ Payment deleted: ${pDel.id}`);
    if (payment.yearlyProgramSubscriptionId) {
      const sDel = await tx.yearlyProgramSubscription.delete({
        where: { id: payment.yearlyProgramSubscriptionId },
      });
      console.log(`✅ Subscription deleted: ${sDel.id}`);
    }
  });

  // PaymentCallbackLog для цього orderReference (cleanup-test-payments не зачепив бо amount=1
  // вже захоплено там, але по orderReference тут — додатковий safety net)
  const logDel = await prisma.paymentCallbackLog.deleteMany({ where: { orderReference: ORDER_REF } });
  console.log(`✅ PaymentCallbackLog deleted: ${logDel.count}`);

  console.log('\n✅ DONE');
}

main().catch(e => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());
