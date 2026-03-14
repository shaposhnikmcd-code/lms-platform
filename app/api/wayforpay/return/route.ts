import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://dr-shaposhnik-platform.vercel.app';
  return NextResponse.redirect(`${baseUrl}/payment/success`, { status: 303 });
}

export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://dr-shaposhnik-platform.vercel.app';
  return NextResponse.redirect(`${baseUrl}/payment/success`, { status: 303 });
}