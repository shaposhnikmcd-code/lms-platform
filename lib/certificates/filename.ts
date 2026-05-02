/// Назва файлу сертифіката для скачування / email-аттача.
/// Формат: "Сертифікат — {Тема} — {Номер}.pdf"
///   COURSE: тема = courseName (snapshot з моменту видачі).
///   YEARLY_PROGRAM: тема = "Річна програма" + категорія (Слухач / Практична участь).
///
/// Для HTTP `Content-Disposition` потрібно повертати і ASCII-fallback, і
/// `filename*=UTF-8''...` (RFC 5987), щоб кирилиця коректно передалась всіма браузерами.

export interface CertLike {
  certNumber: string;
  type: 'COURSE' | 'YEARLY_PROGRAM' | 'SUPERVISION';
  category?: 'LISTENER' | 'PRACTICAL' | null;
  courseName?: string | null;
}

export function certificateFilename(cert: CertLike): string {
  const subject = subjectName(cert);
  const safeSubject = sanitizeForFilename(subject);
  return `Сертифікат — ${safeSubject} — ${cert.certNumber}.pdf`;
}

/// ASCII-only fallback: `Sertyfikat-UIMP-COURSE-2026-00004.pdf`.
/// Використовується як `filename=` коли клієнт не вміє в `filename*`.
export function certificateFilenameAscii(cert: CertLike): string {
  return `Sertyfikat-${cert.certNumber}.pdf`;
}

export function certificateContentDisposition(
  cert: CertLike,
  mode: 'inline' | 'attachment' = 'inline',
): string {
  const utf8 = encodeURIComponent(certificateFilename(cert));
  const ascii = certificateFilenameAscii(cert);
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

function subjectName(cert: CertLike): string {
  if (cert.type === 'COURSE') {
    return (cert.courseName ?? '').trim() || 'Курс';
  }
  if (cert.type === 'SUPERVISION') {
    const topic = (cert.courseName ?? '').trim();
    return topic ? `Супервізія — ${topic}` : 'Супервізія';
  }
  if (cert.category === 'LISTENER') return 'Річна програма (Слухач)';
  if (cert.category === 'PRACTICAL') return 'Річна програма (Практична участь)';
  return 'Річна програма';
}

function sanitizeForFilename(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}
