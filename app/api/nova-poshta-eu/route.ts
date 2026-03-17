import { NextRequest, NextResponse } from 'next/server';

// Кешуємо JWT токен (дійсний 1 годину)
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

async function getJwtToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  const apiKey = process.env.NOVAPOST_EUROPE_API_KEY!;
  const res = await fetch(
    `https://api.novapost.com/v.1.0/clients/authorization?apiKey=${apiKey}`,
    { headers: { 'Accept': 'application/json' } }
  );

  if (!res.ok) {
    throw new Error('Не вдалось отримати JWT токен Nova Post EU');
  }

  const data = await res.json();
  cachedToken = data.jwt;
  tokenExpiry = now + 55 * 60 * 1000; // 55 хвилин
  return cachedToken!;
}

export async function POST(req: NextRequest) {
  try {
    const { countryCode, search } = await req.json();

    if (!countryCode || !search || search.length < 2) {
      return NextResponse.json({ divisions: [] });
    }

    const jwt = await getJwtToken();

    const params = new URLSearchParams();
    params.append('countryCodes[]', countryCode);
    params.append('name', `*${search}*`);
    params.append('limit', '20');

    const res = await fetch(
      `https://api.novapost.com/v.1.0/divisions?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!res.ok) {
      console.error('Nova Post EU API error:', res.status, await res.text());
      return NextResponse.json({ divisions: [] });
    }

    const data = await res.json();
    return NextResponse.json({ divisions: data || [] });

  } catch (error) {
    console.error('❌ Помилка Nova Post EU:', error);
    return NextResponse.json({ divisions: [] });
  }
}