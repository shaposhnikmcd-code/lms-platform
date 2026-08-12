import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { isPromoWindowActive } from '@/lib/paymentPricing';
import { notifyManagers } from '@/lib/connectorNotifications';
import { getConnectorPricing } from '@/lib/connectorPricing';
import { checkRateLimit } from '@/lib/ratelimit';

const CONNECTOR_ORDER_STATUSES = ['NEW', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

async function requireStaff() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  return role === 'ADMIN' || role === 'MANAGER' ? session : null;
}

/// Розумні межі текстових полів замовлення. Роут публічний (без сесії), тому без них
/// у БД можна залити мегабайтні рядки, які потім летять у Telegram-нотифікацію менеджерам.
const FIELD_LIMITS = {
  email: 254,
  fullName: 120,
  phone: 32,
  city: 160,
  postOffice: 300,
} as const;

/// Стеля довідкової доставки. Саме поле в оплату не входить (доставку покупець платить
/// при отриманні за тарифом НП), тож це не захист суми, а санітизація числа, яке піде
/// в БД, в адмінку і в Telegram-нотифікацію менеджерам: без межі туди можна залити
/// сміття або від'ємний орієнтир.
const MAX_SHIPPING_COST = 5000;

export async function POST(req: NextRequest) {
  try {
    const rl = await checkRateLimit(req, 'payment');
    if (!rl.ok) return rl.response!;

    const { email, fullName, phone, city, postOffice, shippingCost, callMe, promoCode } = await req.json();

    // ── Валідація вводу. Роут публічний і створює запис у БД + шле нотифікацію
    // менеджерам, тому перевіряємо все до першого запису.
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const emailV = str(email);
    const fullNameV = str(fullName);
    const phoneV = str(phone);
    const cityV = str(city);
    const postOfficeV = str(postOffice);

    if (!emailV || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailV) || emailV.length > FIELD_LIMITS.email) {
      return NextResponse.json({ success: false, error: 'Невалідний email' }, { status: 400 });
    }
    if (fullNameV.length < 2 || fullNameV.length > FIELD_LIMITS.fullName) {
      return NextResponse.json({ success: false, error: 'Вкажіть коректне ПІБ' }, { status: 400 });
    }
    const phoneDigits = phoneV.replace(/\D/g, '');
    if (phoneV.length > FIELD_LIMITS.phone || phoneDigits.length < 7 || phoneDigits.length > 15) {
      return NextResponse.json({ success: false, error: 'Невалідний номер телефону' }, { status: 400 });
    }
    if (!cityV || cityV.length > FIELD_LIMITS.city) {
      return NextResponse.json({ success: false, error: 'Невалідне місто' }, { status: 400 });
    }
    if (!postOfficeV || postOfficeV.length > FIELD_LIMITS.postOffice) {
      return NextResponse.json({ success: false, error: 'Невалідне відділення або адреса доставки' }, { status: 400 });
    }
    // Доставка приходить з клієнта (калькулятор Nova Poshta) і зберігається як орієнтир.
    // На суму оплати не впливає, але потрапляє в БД/адмінку/нотифікації — тому валідуємо.
    // НП віддає Cost дробовим (напр. 95.5), тож цілого числа тут вимагати не можна —
    // раніше на таких містах замовлення взагалі не створювалось. Округлюємо нижче.
    if (shippingCost !== undefined && shippingCost !== null) {
      if (typeof shippingCost !== 'number' || !Number.isFinite(shippingCost) || shippingCost < 0 || shippingCost > MAX_SHIPPING_COST) {
        return NextResponse.json(
          { success: false, error: `Некоректна вартість доставки (очікується число від 0 до ${MAX_SHIPPING_COST} ₴)` },
          { status: 400 },
        );
      }
    }

    const session = await getServerSession(authOptions);
    const sessionRole = (session?.user as { role?: string } | undefined)?.role;
    const isAdmin = sessionRole === 'ADMIN' || sessionRole === 'MANAGER';

    // Промокод (категорійний для конектора) — серверна перевірка, задає фіксовану ціну гри.
    let promoApplied = false;
    let promoFixedPrice: number | null = null;
    if (typeof promoCode === 'string' && promoCode.trim()) {
      const cat = await prisma.categoryPromoOverride.findUnique({
        where: { category: 'connector' },
        select: {
          promo1Code: true,
          promo1Price: true,
          promo1StartsAt: true,
          promo1ExpiresAt: true,
          promo2Code: true,
          promo2Price: true,
          promo2StartsAt: true,
          promo2ExpiresAt: true,
        },
      });
      const codeUpper = promoCode.trim().toUpperCase();
      if (
        cat?.promo1Code &&
        cat.promo1Code === codeUpper &&
        cat.promo1Price !== null &&
        isPromoWindowActive(cat.promo1StartsAt, cat.promo1ExpiresAt)
      ) {
        promoApplied = true;
        promoFixedPrice = Math.max(1, cat.promo1Price);
      } else if (
        cat?.promo2Code &&
        cat.promo2Code === codeUpper &&
        cat.promo2Price !== null &&
        isPromoWindowActive(cat.promo2StartsAt, cat.promo2ExpiresAt)
      ) {
        promoApplied = true;
        promoFixedPrice = Math.max(1, cat.promo2Price);
      }
    }

    // Ціна гри резолвиться на сервері з БД (override з адмінки) — не довіряємо клієнту.
    const pricing = await getConnectorPricing();
    const baseGamePrice = isAdmin ? 1 : pricing.price;
    const finalGamePrice = promoApplied ? promoFixedPrice! : baseGamePrice;
    /// Орієнтир доставки з НП — довідкове поле для менеджера, зберігаємо як прийшло
    /// (включно з адмін-тестом: менеджеру корисно бачити реальну оцінку). Колонка в БД —
    /// Int, тому дробовий Cost від НП округлюємо.
    const finalShippingCost = typeof shippingCost === 'number' ? Math.round(shippingCost) : 0;
    /// Онлайн оплачується ТІЛЬКИ гра. Доставку покупець платить при отриманні за тарифом
    /// Нової Пошти, тому в `amount` вона не входить — це ж значення бере
    /// `resolveServerPricing` як суму до оплати у WayForPay.
    const finalAmount = finalGamePrice;

    // orderReference генерується server-side щоб не довіряти клієнту
    const orderReference = `connector_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    const order = await prisma.connectorOrder.create({
      data: {
        orderReference,
        email: emailV,
        fullName: fullNameV,
        phone: phoneV,
        city: cityV,
        postOffice: postOfficeV,
        amount: finalAmount,
        gamePrice: finalGamePrice,
        shippingCost: finalShippingCost,
        callMe: callMe || false,
        paymentStatus: 'PENDING',
        orderStatus: 'NEW',
      },
    });

    // Сповіщення менеджерам про нову заявку (best-effort, не блокує відповідь клієнту).
    notifyManagers('new', order).catch((e) =>
      console.error('[connector POST] notifyManagers failed:', e),
    );

    return NextResponse.json({ success: true, orderId: order.id, orderReference });
  } catch (error) {
    console.error('❌ Помилка створення замовлення:', error);
    return NextResponse.json({ success: false, error: 'Помилка сервера' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!(await requireStaff())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const statusFilter =
      status && (CONNECTOR_ORDER_STATUSES as readonly string[]).includes(status)
        ? { orderStatus: status as (typeof CONNECTOR_ORDER_STATUSES)[number] }
        : undefined;

    const orders = await prisma.connectorOrder.findMany({
      where: statusFilter,
      orderBy: { createdAt: 'desc' },
      include: { trackingHistory: { orderBy: { changedAt: 'desc' } } },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('❌ Помилка отримання замовлень:', error);
    return NextResponse.json({ success: false, error: 'Помилка сервера' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!(await requireStaff())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id, orderStatus, trackingNumber, managerNote, actualShippingCost } = await req.json();

    if (orderStatus && !(CONNECTOR_ORDER_STATUSES as readonly string[]).includes(orderStatus)) {
      return NextResponse.json({ success: false, error: 'Invalid orderStatus' }, { status: 400 });
    }

    const data: any = {
      ...(orderStatus && { orderStatus }),
      ...(managerNote !== undefined && { managerNote }),
      ...(actualShippingCost !== undefined && { actualShippingCost: actualShippingCost === null || actualShippingCost === '' ? null : Number(actualShippingCost) }),
    };

    // ТТН — записуємо/оновлюємо, фіксуємо хто і коли востаннє редагував + лог
    let logEntry: { value: string; actor: any } | null = null;
    if (trackingNumber !== undefined) {
      const value = (trackingNumber || '').trim();
      const session = await getServerSession(authOptions);
      const actor = session?.user;
      data.trackingNumber = value || null;
      data.trackingSetAt = value ? new Date() : null;
      data.trackingSetById = value ? (actor?.id ?? null) : null;
      data.trackingSetByName = value ? (actor?.name ?? null) : null;
      data.trackingSetByEmail = value ? (actor?.email ?? null) : null;
      data.trackingSetByRole = value ? (actor?.role ?? null) : null;
      if (value) logEntry = { value, actor };
    }

    const order = await prisma.connectorOrder.update({
      where: { id },
      data,
      include: { trackingHistory: { orderBy: { changedAt: 'desc' } } },
    });

    if (logEntry) {
      await prisma.connectorOrderTrackingLog.create({
        data: {
          orderId: id,
          value: logEntry.value,
          changedById: logEntry.actor?.id ?? null,
          changedByName: logEntry.actor?.name ?? null,
          changedByEmail: logEntry.actor?.email ?? null,
          changedByRole: logEntry.actor?.role ?? null,
        },
      });
      const refreshed = await prisma.connectorOrder.findUnique({
        where: { id },
        include: { trackingHistory: { orderBy: { changedAt: 'desc' } } },
      });
      return NextResponse.json({ success: true, order: refreshed });
    }

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error('❌ Помилка оновлення замовлення:', error);
    return NextResponse.json({ success: false, error: 'Помилка сервера' }, { status: 500 });
  }
}
