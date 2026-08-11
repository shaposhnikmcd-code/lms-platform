/// Спільні захисти для публічних API-проксі (без session), які витрачають
/// зовнішні квоти або наш API-ключ.

/// Пускаємо лише запити з нашого ж origin. Браузер обов'язково шле заголовок
/// `Origin` для POST/fetch, тож відсутній або чужий origin означає, що виклик
/// прийшов не з нашого фронтенду (curl, чужий сайт, скрипт-скрапер).
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const host = request.headers.get('host');
  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}
