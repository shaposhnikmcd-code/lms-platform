import { NextRequest, NextResponse } from 'next/server';
import { appBaseUrl } from '@/lib/mailer';

/// Хости, на які дозволено редіректити після оплати. Host / X-Forwarded-Host
/// повністю контролюються клієнтом, тому без allow-list це open redirect:
/// підроблений заголовок відправив би юзера на чужий домен по нашому ж посиланню.
/// Host потрібен (а не просто appBaseUrl), щоб оплата на pre.uimp поверталась
/// на pre, а не на прод.
function getAllowedHosts(): Set<string> {
  const hosts = new Set<string>(['uimp.com.ua', 'www.uimp.com.ua', 'pre.uimp.com.ua']);
  const envUrls = [
    process.env.NEXTAUTH_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : null,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null,
  ];
  for (const raw of envUrls) {
    if (!raw) continue;
    try { hosts.add(new URL(raw).host.toLowerCase()); } catch { /* ігноруємо криву env */ }
  }
  return hosts;
}

function getBaseUrl(req: NextRequest): string {
  const rawHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  // X-Forwarded-Host може прийти списком через кому — беремо перший.
  const host = rawHost.split(',')[0].trim().toLowerCase();
  if (!host) return appBaseUrl();

  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  if (isLocal && process.env.NODE_ENV !== 'production') return `http://${host}`;

  if (getAllowedHosts().has(host)) return `https://${host}`;

  console.warn('[wfp-return] Host не в allow-list, редірект на дефолтний домен:', host);
  return appBaseUrl();
}

function buildSuccessUrl(baseUrl: string, orderRef: string, type: string): string {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (orderRef) params.set('orderRef', orderRef);
  const qs = params.toString();
  return `${baseUrl}/payment/success${qs ? `?${qs}` : ''}`;
}

function detectType(orderReference: string): string {
  if (orderReference.startsWith('connector_')) return 'connector';
  if (orderReference.startsWith('bundle_')) return 'bundle';
  if (orderReference.startsWith('yearly-program-monthly_')) return 'monthly';
  if (orderReference.startsWith('yearly-program_')) return 'yearly';
  return 'course';
}

export async function POST(req: NextRequest) {
  const baseUrl = getBaseUrl(req);
  try {
    const formData = await req.formData();
    const orderReference = (formData.get('orderReference') as string) || '';
    const type = detectType(orderReference);
    return NextResponse.redirect(buildSuccessUrl(baseUrl, orderReference, type), { status: 303 });
  } catch {
    return NextResponse.redirect(`${baseUrl}/payment/success`, { status: 303 });
  }
}

export async function GET(req: NextRequest) {
  const baseUrl = getBaseUrl(req);
  const orderRef = req.nextUrl.searchParams.get('orderRef') || '';
  const type = req.nextUrl.searchParams.get('type') || (orderRef ? detectType(orderRef) : '');
  return NextResponse.redirect(buildSuccessUrl(baseUrl, orderRef, type), { status: 303 });
}
