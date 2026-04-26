/// Standalone test runner для vector-шаблону сертифіката.
/// Генерує 3 тестові PDF у корені репо. Запуск: `node scripts/test-cert-vector.mjs`.
///
/// Використовує реальну production логіку (імпортує generateCertificatePdf з lib).
/// Для цього lib/certificates/*.ts має бути TS — запускаємо через tsx.

import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const entry = pathToFileURL(path.resolve('lib/certificates/generatePdf.ts')).href;
const { generateCertificatePdf } = await import(entry);

const samples = [
  {
    name: 'yearly-practical.pdf',
    input: {
      templateKey: 'YEARLY_PRACTICAL',
      recipientName: 'Ihor Shaposhnyk',
      issueYear: 2026,
      certNumber: 'UIMP-YEAR-2026-00042',
      verificationUrl: 'https://uimp.com.ua/uk/certificate/abc123',
      category: 'PRACTICAL',
    },
  },
  {
    name: 'yearly-listener.pdf',
    input: {
      templateKey: 'YEARLY_LISTENER',
      recipientName: 'Ihor Shaposhnyk',
      issueYear: 2026,
      certNumber: 'UIMP-YEAR-2026-00043',
      verificationUrl: 'https://uimp.com.ua/uk/certificate/abc124',
      category: 'LISTENER',
    },
  },
  {
    name: 'course.pdf',
    input: {
      templateKey: 'COURSE',
      recipientName: 'Ihor Shaposhnyk',
      issueYear: 2026,
      certNumber: 'UIMP-COURSE-2026-00044',
      verificationUrl: 'https://uimp.com.ua/uk/certificate/abc125',
      courseName: 'Терапія тривожних станів',
    },
  },
];

for (const s of samples) {
  const bytes = await generateCertificatePdf(s.input);
  writeFileSync(`test-${s.name}`, bytes);
  const kb = Math.round(bytes.length / 1024);
  console.log(`wrote test-${s.name} (${kb} KB)`);
}
