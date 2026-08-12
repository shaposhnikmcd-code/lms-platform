import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import zlib from 'zlib';
import { promisify } from 'util';
import { verifyBearer } from '@/lib/authTiming';

const gunzip = promisify(zlib.gunzip);

/// Завантаження + розпакування архіву НП і запис десятків тисяч рядків не вкладаються
/// в дефолтний ліміт (10-60с). Без цього прохід обривався посеред вставок — а таблиця
/// на той момент була вже очищена (стара схема «deleteMany → вставки»).
export const maxDuration = 300;

/// Розмір батчу вставки. Кожен батч іде окремою транзакцією «видали ці id → встав ці id»,
/// тому 500 — компроміс між кількістю round-trip-ів і тривалістю однієї транзакції.
const BATCH_SIZE = 500;

/// Запобіжник від «порожнього» апстріму: якщо джерело раптом віддало підозріло мало
/// відділень (зміна формату, часткова відповідь CDN), синк переривається і стара
/// таблиця лишається недоторканою. Реальний обсяг по цих країнах — тисячі рядків.
const MIN_EXPECTED_DIVISIONS = 100;

const ALLOWED_COUNTRIES =['PL', 'DE', 'CZ', 'LT', 'LV', 'EE', 'IT', 'ES', 'SK', 'HU', 'RO', 'MD', 'FR', 'GB', 'AT', 'NL'];

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
  // Vercel cron авторизація (timing-safe)
  if (!verifyBearer(req.headers.get('authorization'), process.env.CRON_SECRET)) {
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

    // Порожній/обрізаний апстрім не має права стерти робочу таблицю.
    if (filtered.length < MIN_EXPECTED_DIVISIONS) {
      const message = `Джерело віддало лише ${filtered.length} відділень (мінімум ${MIN_EXPECTED_DIVISIONS}) — синк скасовано, стара таблиця збережена`;
      await prisma.novaPostSyncLog.create({
        data: { totalCount: 0, status: 'ERROR', message },
      });
      return NextResponse.json({ error: message }, { status: 502 });
    }

    // Safe-swap замість «стерти все → вставити заново». Стара схема (`deleteMany()` на
    // весь довідник, потім вставки без транзакції) означала, що будь-яке падіння
    // всередині циклу — таймаут функції, обрив мережі, невалідний рядок — лишало
    // порожню таблицю: віджет вибору відділення переставав показувати БУДЬ-ЩО, і
    // полагодити це міг лише наступний нічний прохід.
    //
    // Тепер:
    //   1) кожен батч замінюється атомарно (delete цих id + insert цих id в одній
    //      транзакції) — у будь-який момент часу довідник заповнений;
    //   2) усі свіжі рядки позначені міткою батчу `syncedAt = batchStamp`;
    //   3) лише ПІСЛЯ повного успіху видаляємо все, що старіше за мітку — тобто
    //      відділення, яких у новому вивантаженні більше немає.
    // При падінні на кроці 1-2 таблиця лишається робочою (частина рядків свіжа,
    // частина стара), а крок 3 просто не виконується.
    const batchStamp = new Date();
    let saved = 0;

    for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
      const batch = filtered.slice(i, i + BATCH_SIZE);
      const rows: Prisma.NovaPostDivisionCreateManyInput[] = batch.map((d: NovaDivision) => ({
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
        syncedAt: batchStamp,
      }));
      // Видалення саме цих id перед вставкою обов'язкове: id — первинний ключ, і
      // `skipDuplicates` мовчки пропустив би вже наявні рядки, лишивши їм стару мітку
      // `syncedAt` — фінальне прибирання (крок 3) винесло б їх як «зниклі з джерела».
      await prisma.$transaction([
        prisma.novaPostDivision.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } }),
        prisma.novaPostDivision.createMany({ data: rows, skipDuplicates: true }),
      ]);
      saved += batch.length;
    }

    // Крок 3: відділення, які не прийшли в цьому вивантаженні (закриті/перенесені).
    const stale = await prisma.novaPostDivision.deleteMany({
      where: { syncedAt: { lt: batchStamp } },
    });

    await prisma.novaPostSyncLog.create({
      data: {
        totalCount: saved,
        status: 'SUCCESS',
        message: `Cron: синхронізовано ${saved} відділень${stale.count > 0 ? `, прибрано застарілих ${stale.count}` : ''}`,
      },
    });

    return NextResponse.json({ success: true, total: saved, removed: stale.count });

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