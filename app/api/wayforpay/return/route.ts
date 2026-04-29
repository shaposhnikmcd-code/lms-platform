import { NextRequest, NextResponse } from 'next/server';

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
  if (host) return `${proto}://${host}`;
  return process.env.NEXTAUTH_URL || 'http://localhost:3000';
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
