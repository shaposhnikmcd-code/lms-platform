import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { countryCode, search } = await req.json();

    if (!countryCode || !search || search.length < 2) {
      return NextResponse.json({ cities: [] });
    }

    const results = await prisma.novaPostDivision.findMany({
      where: {
        countryCode,
        city: { contains: search, mode: 'insensitive' },
      },
      select: { city: true },
      distinct: ['city'],
      take: 10,
      orderBy: { city: 'asc' },
    });

    const cities = results.map(r => r.city).filter(Boolean) as string[];
    return NextResponse.json({ cities });

  } catch (error) {
    console.error('❌ Помилка пошуку міст EU:', error);
    return NextResponse.json({ cities: [] });
  }
}