import { NextRequest, NextResponse } from 'next/server';

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
  if (host) return `${proto}://${host}`;
  return process.env.NEXTAUTH_URL || 'http://localhost:3000';
}

export async function POST(req: NextRequest) {
  const baseUrl = getBaseUrl(req);

  // Try to detect course vs connector from form data
  try {
    const formData = await req.formData();
    const orderReference = formData.get('orderReference') as string || '';
    const type = orderReference.startsWith('connector_') ? 'connector' : 'course';
    return NextResponse.redirect(`${baseUrl}/payment/success?type=${type}`, { status: 303 });
  } catch {
    return NextResponse.redirect(`${baseUrl}/payment/success`, { status: 303 });
  }
}

export async function GET(req: NextRequest) {
  const baseUrl = getBaseUrl(req);
  const type = req.nextUrl.searchParams.get('type') || '';
  return NextResponse.redirect(`${baseUrl}/payment/success${type ? `?type=${type}` : ''}`, { status: 303 });
}
