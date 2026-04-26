/// SendPulse Education API клієнт — підтримка двох режимів автентифікації:
/// 1) OAuth2 client_credentials (SENDPULSE_OAUTH_CLIENT_ID + SENDPULSE_OAUTH_SECRET з вкладки "Облікові дані" в кабінеті).
/// 2) Прямий Bearer-auth з API key (SENDPULSE_API_KEY, префікс "sp_apikey_") — якщо OAuth2 creds не задані.
///
/// Відкриття доступу лишається через event URL (SENDPULSE_EVENT_URL) — див. wayforpay/callback.

const API_BASE = 'https://api.sendpulse.com';
/// Edu API має окремий префікс — /edu/public/v1 (з OpenAPI spec).
const EDU_API_BASE = 'https://api.sendpulse.com/edu/public/v1';

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  // Пріоритет 1: OAuth2 (повний доступ, включно з Edu API).
  const oauthId = process.env.SENDPULSE_OAUTH_CLIENT_ID;
  const oauthSecret = process.env.SENDPULSE_OAUTH_SECRET;
  if (oauthId && oauthSecret) {
    const res = await fetch(`${API_BASE}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: oauthId,
        client_secret: oauthSecret,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { access_token: string; expires_in: number };
      cachedToken = { token: data.access_token, expiresAt: now + data.expires_in * 1000 };
      return data.access_token;
    }
    const errText = await res.text().catch(() => '');
    throw new Error(`SendPulse OAuth2 failed: ${res.status} ${errText}`);
  }

  // Пріоритет 2: API key (sp_apikey_...) напряму як Bearer.
  // Edu API може не працювати з цим режимом — тоді користувач має додати OAuth2 creds.
  const apiKey = process.env.SENDPULSE_API_KEY;
  if (apiKey) {
    // Кешуємо на 1 годину (API key довготривалий, але обмежимо перестраховкою).
    cachedToken = { token: apiKey, expiresAt: now + 3600 * 1000 };
    return apiKey;
  }

  throw new Error('SendPulse auth missing: set SENDPULSE_OAUTH_CLIENT_ID + SENDPULSE_OAUTH_SECRET (preferred) or SENDPULSE_API_KEY');
}

/// @param base — `API_BASE` для класичних ендпоінтів або `EDU_API_BASE` для Education API.
async function authedFetch(path: string, init?: RequestInit, base: string = EDU_API_BASE): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

/// Повертає список студентів курсу, які повністю завершили навчання (прогрес 100%).
/// Використовується cron-ом `/api/cron/course-certificates` для авто-видачі сертифікатів.
///
/// ВАЖЛИВО: точна форма відповіді SendPulse Edu API для прогресу не задокументована
/// публічно — приймаємо декілька можливих варіантів у структурі (progress / progressPercent /
/// percentage / lessons_completed_percent) і беремо максимум. Якщо відповідь не містить жодного
/// прогрес-поля — функція повертає пустий масив (cron пропустить без видачі; можна буде
/// видати ручно з адмінки). Після перевірки реальної відповіді SP — можна звузити мапінг.
export type CompletedStudent = {
  studentId: number;
  email: string;
  progressPercent: number;
};

/// Тягне ВСІХ студентів курсу разом з % прогресу. Без фільтра по threshold.
/// Використовується щоденними cron-ами для оновлення Enrollment.spProgressPercent
/// та YearlyProgramSubscription.spProgressPercent (для колонки "Курс завершено" в адмінці).
export async function fetchAllStudentsProgressForCourse(
  courseId: number,
): Promise<CompletedStudent[]> {
  const results: CompletedStudent[] = [];
  let offset = 0;
  const limit = 100;

  for (let safety = 0; safety < 200; safety++) {
    const res = await authedFetch(`/students/by-course/${courseId}`, {
      method: 'POST',
      body: JSON.stringify({ offset, limit }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`SendPulse fetchAllStudentsProgress failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as {
      data?: Array<
        {
          id: number;
          email?: string | null;
          progress?: number | null;
          progressPercent?: number | null;
          percentage?: number | null;
          lessons_completed_percent?: number | null;
          status?: string | null;
        } & Record<string, unknown>
      >;
    };

    const list = data.data ?? [];
    if (list.length === 0) break;

    for (const s of list) {
      const progress =
        s.progress ?? s.progressPercent ?? s.percentage ?? s.lessons_completed_percent ?? null;
      const email = (s.email ?? '').trim().toLowerCase();
      if (!email || progress == null) continue;
      const pct = Number(progress);
      if (!Number.isFinite(pct)) continue;
      results.push({ studentId: s.id, email, progressPercent: pct });
    }

    if (list.length < limit) break;
    offset += limit;
  }

  return results;
}

export async function fetchCompletedStudentsForCourse(
  courseId: number,
  completionThreshold = 100,
): Promise<CompletedStudent[]> {
  const all = await fetchAllStudentsProgressForCourse(courseId);
  return all.filter((s) => s.progressPercent >= completionThreshold);
}

/// Знаходить студента на курсі за email. Повертає studentId (int) або null.
/// Використовує POST /students/by-course/{courseId} з пагінацією.
export async function lookupStudentIdByEmail(
  courseId: number,
  email: string,
): Promise<number | null> {
  const normalized = email.trim().toLowerCase();
  let offset = 0;
  const limit = 100;

  for (let safety = 0; safety < 50; safety++) {
    const res = await authedFetch(`/students/by-course/${courseId}`, {
      method: 'POST',
      body: JSON.stringify({ offset, limit }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`SendPulse lookupStudent failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as {
      data?: Array<{ id: number; email?: string | null }>;
      total?: number;
    };

    const list = data.data ?? [];
    if (list.length === 0) return null;

    const match = list.find((s) => (s.email ?? '').toLowerCase() === normalized);
    if (match) return match.id;

    if (list.length < limit) return null;
    offset += limit;
  }

  return null;
}

/// Закриває доступ студента до конкретного курсу.
/// DELETE /students/{studentId}/{courseId}. 404 трактуємо як "вже закритий" (idempotent).
export async function closeAccessInCourse(studentId: number, courseId: number): Promise<void> {
  const res = await authedFetch(`/students/${studentId}/${courseId}`, {
    method: 'DELETE',
  });

  if (res.status === 404) {
    return; // вже закритий
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SendPulse closeAccess failed: ${res.status} ${text}`);
  }
}

/// Шле event у SendPulse funnel — відкриття доступу (додавання в курс).
/// Reuses existing SENDPULSE_EVENT_URL which triggers the funnel.
export async function openAccessViaEvent(
  email: string,
  productName: string,
  productPrice: number,
): Promise<void> {
  const eventUrl = process.env.SENDPULSE_EVENT_URL;
  if (!eventUrl) {
    throw new Error('SENDPULSE_EVENT_URL missing in env');
  }

  const res = await fetch(eventUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      phone: '',
      product_name: productName,
      product_id: 0,
      product_price: productPrice,
      order_date: new Date().toISOString().split('T')[0],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SendPulse event failed: ${res.status} ${text}`);
  }
}
