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

/// Cert number формату: UIMP-COURSE-2026-00042 / UIMP-YEAR-2026-00007
/// Номер — це кількість certs того ж type + року + 1, padded до 5 цифр.
export async function generateCertNumber(
  type: CertificateType,
  issueYear: number,
): Promise<string> {
  const prefix = type === 'COURSE' ? 'COURSE' : 'YEAR';

  const startOfYear = new Date(Date.UTC(issueYear, 0, 1));
  const startOfNextYear = new Date(Date.UTC(issueYear + 1, 0, 1));

  const count = await prisma.certificate.count({
    where: {
      type,
      issuedAt: { gte: startOfYear, lt: startOfNextYear },
    },
  });

  const seq = String(count + 1).padStart(5, '0');
  return `UIMP-${prefix}-${issueYear}-${seq}`;
}

/// SHA-256 хеш PDF-bytes для audit integrity. Зберігаємо в Certificate.pdfHash.
export function hashPdfBytes(bytes: Uint8Array): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
