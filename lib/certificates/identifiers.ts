/// Генерація ідентифікаторів сертифіката: humanно-читабельний certNumber і
/// криптостійкий verificationToken для публічної верифікації.

import crypto from 'crypto';
import { customAlphabet } from 'nanoid';
import prisma from '@/lib/prisma';
import type { CertificateType } from '@prisma/client';

/// Token для URL — 32 символи з безпечного алфавіту (без схожих 0/O, l/1, тощо).
/// Простір: 32^32 ≈ 10^48 — непередбачуваний і неперебираемий.
const TOKEN_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
const generateToken = customAlphabet(TOKEN_ALPHABET, 32);

export function newVerificationToken(): string {
  return generateToken();
}

function numberPrefixFor(type: CertificateType, issueYear: number): string {
  const prefix = type === 'COURSE' ? 'COURSE' : type === 'SUPERVISION' ? 'SUPER' : 'YEAR';
  return `UIMP-${prefix}-${issueYear}-`;
}

/// Cert number формату: UIMP-COURSE-2026-00042 / UIMP-YEAR-2026-00007 / UIMP-SUPER-2026-00012
///
/// Номер = максимальний уже виданий номер того ж типу й року + 1, padded до 5 цифр.
/// Раніше рахувався як `count() + 1`; це давало не тільки гонки, а й стабільні колізії
/// після видалення будь-якого сертифіката (count падав, наступний номер повторював
/// зайнятий). max+1 монотонний і не «відкочується».
///
/// Гонку між паралельними видачами це саме по собі не закриває — читання й запис не в
/// одній транзакції. Її ловить `createWithUniqueCertNumber` (retry на P2002).
export async function generateCertNumber(
  type: CertificateType,
  issueYear: number,
): Promise<string> {
  const numberPrefix = numberPrefixFor(type, issueYear);

  /// Лексикографічне спадне сортування = числове, поки всі номери однакової ширини
  /// (5 цифр). Понад 99 999 сертифікатів одного типу за рік у нас не буде.
  const last = await prisma.certificate.findFirst({
    where: { type, certNumber: { startsWith: numberPrefix } },
    orderBy: { certNumber: 'desc' },
    select: { certNumber: true },
  });

  const lastSeq = last ? Number.parseInt(last.certNumber.slice(numberPrefix.length), 10) : 0;
  const next = Number.isFinite(lastSeq) && lastSeq > 0 ? lastSeq + 1 : 1;
  return `${numberPrefix}${String(next).padStart(5, '0')}`;
}

/// P2002 саме по колонці certNumber (а не по partial unique index
/// `Certificate_active_userId_type_courseId_key`, який означає «активний серт уже є»
/// і ретраїтись НЕ має).
function isCertNumberConflict(err: unknown): boolean {
  const e = err as { code?: unknown; meta?: { target?: unknown } } | null;
  if (!e || e.code !== 'P2002') return false;
  const target = e.meta?.target;
  const asText = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return asText.toLowerCase().includes('certnumber');
}

const MAX_CERT_NUMBER_ATTEMPTS = 5;

/// Створення сертифіката з гарантовано вільним `certNumber`.
///
/// Навіщо: номер обчислюється читанням (max+1) поза транзакцією, тож дві паралельні
/// видачі (пакетна супервізія, bulk-видача Річної, два менеджери одночасно) легко
/// отримують той самий номер — і друга падає на unique-конфлікті. Замість того щоб
/// віддати менеджеру «Unique constraint failed», перечитуємо max і пробуємо ще раз.
///
/// `create` отримує вільний номер і має виконати рівно один `prisma.certificate.create`.
/// Будь-яка інша помилка (у т.ч. P2002 по «активний серт уже існує») прокидається одразу.
export async function createWithUniqueCertNumber<T>(
  type: CertificateType,
  issueYear: number,
  create: (certNumber: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < MAX_CERT_NUMBER_ATTEMPTS; attempt++) {
    const certNumber = await generateCertNumber(type, issueYear);
    try {
      return await create(certNumber);
    } catch (err) {
      if (!isCertNumberConflict(err)) throw err;
      /// Джитер, щоб конкуренти не перечитували max синхронно й не билися знову.
      const backoff = 25 * (attempt + 1) + Math.floor(Math.random() * 40);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw new Error(
    'Не вдалося підібрати вільний номер сертифіката (забагато одночасних видач). Спробуйте ще раз.',
  );
}

/// SHA-256 хеш PDF-bytes для audit integrity. Зберігаємо в Certificate.pdfHash.
export function hashPdfBytes(bytes: Uint8Array): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
