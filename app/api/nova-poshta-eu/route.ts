import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkRateLimit } from '@/lib/ratelimit';
import { isSameOrigin } from '@/lib/apiGuards';

export async function POST(req: NextRequest) {
  try {
    // Endpoint публічний (без session) і робить пошук по БД — same-origin + rate limit,
    // як і решта proxy-роутів Нової Пошти.
    if (!isSameOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rl = await checkRateLimit(req, 'novaPoshta');
    if (!rl.ok) return rl.response!;

    const { countryCode, search, city } = await req.json();

    if (typeof countryCode !== 'string' || !countryCode) {
      return NextResponse.json({ divisions: [] });
    }

    const where: any = { countryCode };

    if (typeof city === 'string' && city) {
      where.city = { equals: city.slice(0, 100), mode: 'insensitive' };
    }

    if (typeof search === 'string' && search.length >= 2) {
      const term = search.slice(0, 100);
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { address: { contains: term, mode: 'insensitive' } },
      ];
    }

    const divisions = await prisma.novaPostDivision.findMany({
      where,
      take: 20,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ divisions });

  } catch (error) {
    console.error('❌ Помилка пошуку Nova Post EU:', error);
    return NextResponse.json({ divisions: [] });
  }
}