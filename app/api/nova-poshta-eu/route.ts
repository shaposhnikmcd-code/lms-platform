import { NextRequest, NextResponse } from 'next/server';

async function getJwtToken(): Promise<string> {
  const apiKey = process.env.NOVAPOST_EUROPE_API_KEY!;
  console.log('🔑 Nova Post EU API key:', apiKey ? 'є' : 'ВІДСУТНІЙ');

  const res = await fetch(
    `https://api.novapost.com/v.1.0/clients/authorization?apiKey=${apiKey}`,
    { headers: { 'Accept': 'application/json' } }
  );

  const text = await res.text();
  console.log('🔑 JWT response status:', res.status);
  console.log('🔑 JWT response body:', text);

  if (!res.ok) throw new Error('Не вдалось отримати JWT токен');

  const data = JSON.parse(text);
  return data.jwt;
}

export async function POST(req: NextRequest) {
  try {
    const { countryCode, search } = await req.json();
    console.log('🌍 Nova Post EU запит:', { countryCode, search });

    if (!countryCode || !search || search.length < 2) {
      return NextResponse.json({ divisions: [] });
    }

    const jwt = await getJwtToken();
    console.log('🔑 JWT отримано:', jwt ? 'так' : 'ні');

    const params = new URLSearchParams();
    params.append('countryCodes[]', countryCode);
    params.append('name', `*${search}*`);
    params.append('limit', '20');

    const url = `https://api.novapost.com/v.1.0/divisions?${params.toString()}`;
    console.log('🌍 Запит до Nova Post EU:', url);

    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Accept': 'application/json',
      },
    });

    const text = await res.text();
    console.log('🌍 Nova Post EU відповідь status:', res.status);
    console.log('🌍 Nova Post EU відповідь body:', text.substring(0, 500));

    if (!res.ok) {
      return NextResponse.json({ divisions: [] });
    }

    const data = JSON.parse(text);
    return NextResponse.json({ divisions: data || [] });

  } catch (error) {
    console.error('❌ Помилка Nova Post EU:', error);
    return NextResponse.json({ divisions: [] });
  }
}