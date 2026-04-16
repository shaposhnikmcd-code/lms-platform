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
