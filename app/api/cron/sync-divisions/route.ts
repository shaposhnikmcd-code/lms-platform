import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);

const ALLOWED_COUNTRIES = ['PL', 'DE', 'CZ', 'LT', 'LV', 'EE', 'IT', 'ES', 'SK', 'HU', 'RO', 'MD', 'FR', 'GB', 'AT', 'NL'];

interface NovaDivision {
  id: string;
  name?: string;
  countryCode?: string;
  address?: string;
  settlement?: { name?: string };
  latitude?: number;
  longitude?: number;
  status?: string;
  divisionCategory?: string;
}

export async function GET(req: NextRequest) {
  // Vercel cron авторизація
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const versionsRes = await fetch('https://api.novapost.com/divisions/versions');
    const versions = await versionsRes.json();
    const archiveUrl = versions.base_version.url;

    const archiveRes = await fetch(archiveUrl);
    const buffer = await archiveRes.arrayBuffer();
    const decompressed = await gunzip(Buffer.from(buffer));
    const divisions = JSON.parse(decompressed.toString('utf-8'));

    const filtered = divisions.filter((d: NovaDivision) =>
      d.countryCode !== undefined && ALLOWED_COUNTRIES.includes(d.countryCode) && d.status === 'Working'
    );

    await prisma.novaPostDivision.deleteMany();

    const BATCH_SIZE = 500;
    let saved = 0;

    for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
      const batch = filtered.slice(i, i + BATCH_SIZE);
      await prisma.novaPostDivision.createMany({
        data: batch.map((d: NovaDivision) => ({
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
    }

    await prisma.novaPostSyncLog.create({
      data: {
        totalCount: saved,
        status: 'SUCCESS',
        message: `Cron: синхронізовано ${saved} відділень`,
      },
    });

    return NextResponse.json({ success: true, total: saved });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.novaPostSyncLog.create({
      data: {
        totalCount: 0,
        status: 'ERROR',
        message,
      },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}