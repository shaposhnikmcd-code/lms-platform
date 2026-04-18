/// WayForPay helpers — сигнатури + server-to-server Charge по recToken
/// (для авто-списань Місячної підписки Річної програми).

import crypto from 'crypto';

const API_URL = 'https://api.wayforpay.com/api';

/// Побудова HMAC-MD5 підпису з масиву полів, розділених `;`.
export function signFields(fields: (string | number)[], secretKey: string): string {
  return crypto
    .createHmac('md5', secretKey)
    .update(fields.join(';'))
    .digest('hex');
}

/// Параметри, що йдуть у Purchase як flags для токенізації + регулярних списань.
/// Використовується для ПЕРШОГО платежу Місячної підписки — WFP запамʼятає картку
/// і почне щомісячно списувати автоматично. Кожне списання шле callback на serviceUrl.
export function buildRegularPurchaseFlags(opts: {
  amount: number;
  dateBegin?: Date;
  dateEnd?: Date;
}) {
  const begin = opts.dateBegin ?? new Date();
  const end = opts.dateEnd ?? new Date(begin.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  };
  return {
    regularOn: '1',
    regularMode: 'monthly',
    regularAmount: opts.amount,
    dateBegin: fmt(begin),
    dateEnd: fmt(end),
  };
}

/// Server-to-server Charge по збереженому recToken — без CVV, без 3DS.
/// Повертає response від WFP; успіх зазвичай transactionStatus="Approved".
export async function chargeByRecToken(opts: {
  merchantAccount: string;
  merchantDomainName: string;
  merchantSecretKey: string;
  orderReference: string;
  amount: number;
  currency?: string;
  productName: string;
  productPrice: number;
  productCount?: number;
  recToken: string;
  email: string;
  clientFirstName?: string;
  clientLastName?: string;
  clientPhone?: string;
  serviceUrl?: string;
}): Promise<{
  ok: boolean;
  transactionStatus: string | null;
  reason: string | null;
  raw: Record<string, unknown>;
}> {
  const orderDate = Math.floor(Date.now() / 1000);
  const currency = opts.currency ?? 'UAH';
  const productCount = opts.productCount ?? 1;

  const signature = signFields(
    [
      opts.merchantAccount,
      opts.merchantDomainName,
      opts.orderReference,
      orderDate,
      opts.amount,
      currency,
      opts.productName,
      productCount,
      opts.productPrice,
    ],
    opts.merchantSecretKey,
  );

  const body: Record<string, unknown> = {
    transactionType: 'CHARGE',
    merchantAccount: opts.merchantAccount,
    merchantDomainName: opts.merchantDomainName,
    merchantSignature: signature,
    apiVersion: 1,
    orderReference: opts.orderReference,
    orderDate,
    amount: opts.amount,
    currency,
    productName: [opts.productName],
    productPrice: [opts.productPrice],
    productCount: [productCount],
    recToken: opts.recToken,
    clientEmail: opts.email,
  };
  if (opts.clientFirstName) body.clientFirstName = opts.clientFirstName;
  if (opts.clientLastName) body.clientLastName = opts.clientLastName;
  if (opts.clientPhone) body.clientPhone = opts.clientPhone;
  if (opts.serviceUrl) body.serviceUrl = opts.serviceUrl;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const transactionStatus = (raw.transactionStatus as string | undefined) ?? null;
  const reason = (raw.reason as string | undefined) ?? null;

  return {
    ok: res.ok && transactionStatus === 'Approved',
    transactionStatus,
    reason,
    raw,
  };
}

/// Скасування регулярного платежу (якщо раніше створювали через regularApi CREATE).
/// Використовується, коли юзер скасовує підписку — WFP припиняє списання.
export async function removeRegularSchedule(opts: {
  merchantAccount: string;
  merchantPassword: string;
  orderReference: string;
}): Promise<{ ok: boolean; raw: Record<string, unknown> }> {
  const res = await fetch('https://api.wayforpay.com/regularApi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestType: 'REMOVE',
      merchantAccount: opts.merchantAccount,
      merchantPassword: opts.merchantPassword,
      orderReference: opts.orderReference,
      apiVersion: 1,
    }),
  });
  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok && (raw.reasonCode === 1100 || raw.status === 'Accept'), raw };
}
