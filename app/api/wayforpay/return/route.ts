import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://dr-shaposhnik-platform.vercel.app';

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
  const baseUrl = process.env.NEXTAUTH_URL || 'https://dr-shaposhnik-platform.vercel.app';
  const type = req.nextUrl.searchParams.get('type') || '';
  return NextResponse.redirect(`${baseUrl}/payment/success${type ? `?type=${type}` : ''}`, { status: 303 });
}
