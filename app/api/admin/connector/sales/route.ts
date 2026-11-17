import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import {
  getConnectorSalesState,
  setConnectorSalesState,
  CONNECTOR_PAUSED_LABEL_MAX,
  CONNECTOR_PAUSED_NOTE_MAX,
  CONNECTOR_SALES_LOCALES,
  type ConnectorSalesInput,
} from '@/lib/connectorSales';
import { revalidateLocalized } from '@/lib/revalidatePaths';

/// GET — поточний стан продажу гри «Конектор».
/// POST — body `{ paused: boolean, texts: { uk|en|pl: { label?: string, note?: string } } }`:
///   зупинити/відновити продаж і задати текст кнопки й пояснення на кожну мову. Лише ADMIN.

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ sales: await getConnectorSalesState() });
}

function cleanText(raw: unknown, max: number): string | null | 'invalid' {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return 'invalid';
  const t = raw.replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (t.length > max) return 'invalid';
  return t;
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.paused !== 'boolean') {
    return NextResponse.json({ error: 'paused має бути boolean' }, { status: 400 });
  }
  const rawTexts = (body.texts && typeof body.texts === 'object' ? body.texts : {}) as Record<
    string,
    Record<string, unknown> | undefined
  >;
  const texts = {} as ConnectorSalesInput['texts'];
  for (const loc of CONNECTOR_SALES_LOCALES) {
    const t = rawTexts[loc] ?? {};
    const label = cleanText(t.label, CONNECTOR_PAUSED_LABEL_MAX);
    if (label === 'invalid') {
      return NextResponse.json(
        { error: `Текст кнопки (${loc.toUpperCase()}) — до ${CONNECTOR_PAUSED_LABEL_MAX} символів` },
        { status: 400 },
      );
    }
    const note = cleanText(t.note, CONNECTOR_PAUSED_NOTE_MAX);
    if (note === 'invalid') {
      return NextResponse.json(
        { error: `Пояснення (${loc.toUpperCase()}) — до ${CONNECTOR_PAUSED_NOTE_MAX} символів` },
        { status: 400 },
      );
    }
    texts[loc] = { label, note };
  }
  const actor = (await getAdminActor(req))?.email ?? null;
  const sales = await setConnectorSalesState({ paused: body.paused, texts }, actor);
  // Сторінки гри мають revalidate=0, але перестраховуємось для кешу маршруту.
  revalidateLocalized('/games');
  revalidateLocalized('/links/connector');
  return NextResponse.json({ sales });
}
