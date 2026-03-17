import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);

const ALLOWED_COUNTRIES = ['PL', 'DE', 'CZ', 'LT', 'LV', 'EE', 'IT', 'ES', 'SK', 'HU', 'RO', 'MD', 'FR', 'GB', 'AT', 'NL'];

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const versionsRes = await fetch('https://api.novapost.com/divisions/versions');
    const versions = await versionsRes.json();
    const archiveUrl = versions.base_version.url;

    console.log('📦 Завантажуємо архів:', archiveUrl);

    const archiveRes = await fetch(archiveUrl);
    const buffer = await archiveRes.arrayBuffer();
    const decompressed = await gunzip(Buffer.from(buffer));
    const raw = JSON.parse(decompressed.toString('utf-8'));

    // Дані в raw.items
    const allDivisions = Array.isArray(raw) ? raw : (raw.items || []);

    console.log(`📦 Всього відділень: ${allDivisions.length}`);

    // Логуємо перший елемент щоб побачити структуру countryCode
    if (allDivisions.length > 0) {
      console.log('📦 Перший елемент:', JSON.stringify(allDivisions[0]).substring(0, 500));
    }

    // Фільтруємо по countryCode
    const filtered = allDivisions.filter((d: any) =>
      d.countryCode && ALLOWED_COUNTRIES.includes(d.countryCode)
    );

    console.log(`📦 Після фільтрації: ${filtered.length}`);

    if (filtered.length === 0) {
      // Якщо пусто — покажемо унікальні countryCodes
      const codes = [...new Set(allDivisions.slice(0, 100).map((d: any) => d.countryCode))];
      console.log('📦 Унікальні countryCodes (перші 100):', codes);
      return NextResponse.json({ debug: true, total: allDivisions.length, filtered: 0, codes });
    }

    await prisma.novaPostDivision.deleteMany();

    const BATCH_SIZE = 500;
    let saved = 0;

    for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
      const batch = filtered.slice(i, i + BATCH_SIZE);
      await prisma.novaPostDivision.createMany({
        data: batch.map((d: any) => ({
          id: d.id,
          externalId: d.id,
          name: d.name || '',
          countryCode: d.countryCode,
          address: d.address || null,
          city: d.settlement?.name || null,
          latitude: d.latitude || null,
          longitude: d.longitude || null,
          status: d.status || null,
          category: d.divisionCategory || null,
          syncedAt: new Date(),
        })),
        skipDuplicates: true,
      });
      saved += batch.length;
      console.log(`✅ Збережено ${saved}/${filtered.length}`);
    }

    await prisma.novaPostSyncLog.create({
      data: {
        totalCount: saved,
        status: 'SUCCESS',
        message: `Синхронізовано ${saved} відділень`,
      },
    });

    return NextResponse.json({ success: true, total: saved });

  } catch (error: any) {
    console.error('❌ Помилка:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}