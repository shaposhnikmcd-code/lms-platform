/// Paddle (Merchant of Record) — серверні утиліти для закордонних платежів.
/// Дзеркало до lib/wayforpay.ts, але для іноземців: іноземець → Paddle → Payoneer → ФОП.
/// Paddle сам закриває EU VAT / US sales tax. Українські оплати лишаються на WayForPay.
///
/// ⚠️ Поки не заповнені env (PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET, PADDLE_ENV) —
/// усі виклики повертають помилку конфігурації. Заповнюються у Фазі 1 після
/// реєстрації акаунта Paddle (див. PLAN-foreign-payments-mor.md).

import crypto from 'crypto';

export type PaddleEnv = 'sandbox' | 'production';

export interface PaddleCreds {
  apiKey: string;
  webhookSecret: string;
  env: PaddleEnv;
  apiBase: string;
}

/// Читає Paddle-креди з env. Кидає, якщо не сконфігуровано — викликач має
/// обробити (повернути 503 «paddle_not_configured»), а не падати 500.
export function getPaddleCreds(): PaddleCreds {
  const apiKey = process.env.PADDLE_API_KEY;
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
  const env: PaddleEnv = process.env.PADDLE_ENV === 'production' ? 'production' : 'sandbox';
  if (!apiKey || !webhookSecret) {
    throw new Error('paddle_not_configured');
  }
  const apiBase = env === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';
  return { apiKey, webhookSecret, env, apiBase };
}

export function isPaddleConfigured(): boolean {
  return !!process.env.PADDLE_API_KEY && !!process.env.PADDLE_WEBHOOK_SECRET;
}

/// Валідація підпису webhook-а Paddle Billing.
/// Заголовок: `Paddle-Signature: ts=<unix>;h1=<hex hmac>`.
/// Підписаний payload = `${ts}:${rawBody}`, HMAC-SHA256 з webhookSecret.
/// rawBody має бути САМИМ сирим текстом тіла (не re-stringified JSON) — інакше підпис не зійдеться.
export function verifyPaddleSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  let ts = '';
  let h1 = '';
  for (const part of signatureHeader.split(';')) {
    const [k, v] = part.split('=');
    if (k === 'ts') ts = v;
    else if (k === 'h1') h1 = v;
  }
  if (!ts || !h1) return false;

  const { webhookSecret } = getPaddleCreds();
  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${ts}:${rawBody}`)
    .digest('hex');

  // Timing-safe порівняння однакової довжини.
  const a = Buffer.from(h1, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export interface CreateTransactionArgs {
  /// Paddle Price ID (pri_...) — джерело правди про суму в USD.
  priceId: string;
  /// Email покупця (передаємо у Paddle, щоб префілити checkout).
  email: string;
  /// Наш orderReference + будь-які метадані — повернуться у webhook (data.custom_data).
  customData: Record<string, string>;
  /// Куди Paddle поверне покупця після успіху (наша /payment/success).
  successUrl: string;
}

export interface CreatedTransaction {
  transactionId: string;
  checkoutUrl: string | null;
}

/// Створює Paddle Transaction і повертає hosted-checkout URL.
/// Потребує налаштованого Default Payment Link у Paddle (Checkout settings),
/// інакше data.checkout.url буде null — тоді checkout робиться через Paddle.js на клієнті.
export async function createPaddleTransaction(args: CreateTransactionArgs): Promise<CreatedTransaction> {
  const { apiKey, apiBase } = getPaddleCreds();

  const res = await fetch(`${apiBase}/transactions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [{ price_id: args.priceId, quantity: 1 }],
      collection_mode: 'automatic',
      custom_data: args.customData,
      checkout: { url: args.successUrl },
      customer: undefined, // email передаємо через checkout-prefill нижче, customer створює Paddle
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`paddle_create_transaction_failed: HTTP ${res.status} ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as { data?: { id?: string; checkout?: { url?: string } } };
  const transactionId = json.data?.id;
  if (!transactionId) {
    throw new Error('paddle_create_transaction_no_id');
  }
  return {
    transactionId,
    checkoutUrl: json.data?.checkout?.url ?? null,
  };
}
