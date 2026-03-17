import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { countryCode, search, city } = await req.json();

    if (!countryCode) {
      return NextResponse.json({ divisions: [] });
    }

    const where: any = { countryCode };

    if (city) {
      where.city = { equals: city, mode: 'insensitive' };
    }

    if (search && search.length >= 2) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
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