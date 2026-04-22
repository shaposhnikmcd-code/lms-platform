import prisma from './_db.mjs';
try {
  const rows = await prisma.$queryRaw`SELECT COUNT(*)::int AS c FROM "PaymentCallbackLog"`;
  console.log('✅ Таблиця PaymentCallbackLog існує. Записів:', rows[0].c);
} catch (e) {
  console.error('❌', e.message);
}
await prisma.$disconnect();
