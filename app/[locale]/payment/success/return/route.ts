import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  return NextResponse.redirect(
    new URL('/payment/success', req.url)
  );
}

export async function GET(req: NextRequest) {
  return NextResponse.redirect(
    new URL('/payment/success', req.url)
  );
}