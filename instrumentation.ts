export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  try {
    const { syncCatalogCourses } = await import('./lib/syncCatalogCourses');
    await syncCatalogCourses();
    console.log('[instrumentation] Catalog courses synced');
  } catch (err) {
    console.error('[instrumentation] Failed to sync catalog courses:', err);
  }
}

/// Єдина точка, куди Next віддає КОЖНУ серверну помилку (SSR, RSC, route handler,
/// server action) разом з digest-ом і маршрутом. Без цього хука в логах лишався
/// лише стек без контексту «де саме» і без digest-а, який бачить користувач на
/// сторінці помилки — зіставити скаргу «у мене код 1a2b3c» з логом було неможливо.
/// Формат — один рядок JSON, щоб Vercel Logs шукалися по `[request-error]`.
export function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
  context: { routerKind?: string; routePath?: string; routeType?: string; revalidateReason?: string },
) {
  const err = error as { message?: string; digest?: string; stack?: string };
  console.error(
    '[request-error] ' +
      JSON.stringify({
        at: new Date().toISOString(),
        digest: err?.digest ?? null,
        message: err?.message ?? String(error),
        method: request?.method ?? null,
        path: request?.path ?? null,
        routePath: context?.routePath ?? null,
        routeType: context?.routeType ?? null,
        routerKind: context?.routerKind ?? null,
        revalidateReason: context?.revalidateReason ?? null,
        stack: err?.stack ?? null,
      }),
  );
}
