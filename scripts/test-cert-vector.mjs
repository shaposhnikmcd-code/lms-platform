/// Standalone test runner для vector-шаблону сертифіката.
/// Генерує тестові PDF у корені репо (або в `CERT_TEST_OUT_DIR`).
/// Запуск: `node scripts/test-cert-vector.mjs`.
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
      recipientName: 'John Bunyan',
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
      recipientName: 'John Bunyan',
      issueYear: 2026,
      certNumber: 'UIMP-YEAR-2026-00043',
      verificationUrl: 'https://uimp.com.ua/uk/certificate/abc124',
      category: 'LISTENER',
    },
  },
  {
    name: 'yearly-participant.pdf',
    input: {
      templateKey: 'YEARLY_PARTICIPANT',
      recipientName: 'John Bunyan',
      issueYear: 2026,
      certNumber: 'UIMP-YEAR-2026-00045',
      verificationUrl: 'https://uimp.com.ua/uk/certificate/abc126',
      category: 'PARTICIPANT',
    },
  },
  {
    /// Двомовний: 1-ша сторінка укр., 2-га англ. з recipientNameEn.
    name: 'yearly-bilingual.pdf',
    input: {
      templateKey: 'YEARLY_PRACTICAL',
      recipientName: 'Олена Іваненко',
      recipientNameEn: 'Olena Ivanenko',
      issueYear: 2026,
      certNumber: 'UIMP-YEAR-2026-00046',
      verificationUrl: 'https://uimp.com.ua/uk/certificate/abc127',
      category: 'PRACTICAL',
    },
  },
  {
    /// Двомовний + категорія «Учасник».
    name: 'yearly-bilingual-participant.pdf',
    input: {
      templateKey: 'YEARLY_PARTICIPANT',
      recipientName: 'Олена Іваненко',
      recipientNameEn: 'Olena Ivanenko',
      issueYear: 2026,
      certNumber: 'UIMP-YEAR-2026-00047',
      verificationUrl: 'https://uimp.com.ua/uk/certificate/abc128',
      category: 'PARTICIPANT',
    },
  },
  {
    name: 'course.pdf',
    input: {
      templateKey: 'COURSE',
      recipientName: 'John Bunyan',
      issueYear: 2026,
      certNumber: 'UIMP-COURSE-2026-00044',
      verificationUrl: 'https://uimp.com.ua/uk/certificate/abc125',
      courseName: 'Терапія тривожних станів',
    },
  },
];

const outDir = process.env.CERT_TEST_OUT_DIR || '.';
for (const s of samples) {
  const bytes = await generateCertificatePdf(s.input);
  const file = path.join(outDir, `test-${s.name}`);
  writeFileSync(file, bytes);
  const kb = Math.round(bytes.length / 1024);
  console.log(`wrote ${file} (${kb} KB)`);
}
