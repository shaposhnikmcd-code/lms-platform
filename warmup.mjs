const BASE_URL = 'https://www.uimp.com.ua';
const LOCALES = ['pl', 'en'];

const PAGES = [
  '/',
  '/courses',
  '/courses/psychology-basics',
  '/courses/psychiatry-basics',
  '/courses/mentorship',
  '/courses/Fundamentals-of-Christian-Psychology-2.0',
  '/courses/psychotherapy-of-biblical-heroes',
  '/courses/sex-education',
  '/consultations',
  '/consultations/tetiana-shaposhnyk',
  '/contacts',
  '/games',
  '/learning',
  '/links',
  '/links/connector',
  '/news',
  '/privacy',
  '/terms',
];

async function fetchPage(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    console.log(`${res.status === 200 ? '✓' : '✗'} ${url} → ${res.status}`);
  } catch (e) {
    console.log(`✗ ${url} → ERROR: ${e.message}`);
  }
}

async function warmup() {
  console.log('🔥 Починаємо прогрів кешу...\n');
  for (const locale of LOCALES) {
    console.log(`\n--- Локаль: ${locale} ---`);
    for (const page of PAGES) {
      const url = `${BASE_URL}/${locale}${page === '/' ? '' : page}`;
      await fetchPage(url);
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  console.log('\n✅ Прогрів завершено!');
}

warmup();