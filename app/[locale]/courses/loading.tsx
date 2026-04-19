// Skeleton під час SSR-rendering /courses. Без нього користувач бачить
// білий екран до завершення Prisma-запитів і next-intl.
// Структура повторює основні секції page.tsx (hero + список курсів) — щоб
// не було layout-shift при появі реального контенту.
const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

function ShimmerStyle() {
  return (
    <style>{`
      @keyframes uimpShimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      .uimp-skel {
        background: linear-gradient(90deg, rgba(28,58,46,0.06) 0%, rgba(28,58,46,0.12) 50%, rgba(28,58,46,0.06) 100%);
        background-size: 200% 100%;
        animation: uimpShimmer 1.4s ease-in-out infinite;
        border-radius: 12px;
      }
    `}</style>
  );
}

export default function CoursesLoading() {
  return (
    <div style={{ background: '#F5F2ED', minHeight: '100vh' }}>
      <ShimmerStyle />

      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #1C3A2E 0%, #1a3828 50%, #0f2219 100%)', paddingTop: 52, paddingBottom: 48 }}>
        <div className="container mx-auto px-4 sm:px-8 md:px-16">
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <div style={{ flex: 1 }}>
              <div className="uimp-skel" style={{ width: 60, height: 22, marginBottom: 20, opacity: 0.25 }} />
              <div className="uimp-skel" style={{ width: '70%', height: 48, marginBottom: 14, opacity: 0.2 }} />
              <div className="uimp-skel" style={{ width: '50%', height: 14, opacity: 0.18 }} />
            </div>
            <div className="hidden md:block" style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <div className="uimp-skel" style={{ width: 208, height: 208, borderRadius: '50%', opacity: 0.18 }} />
            </div>
          </div>
        </div>
      </section>

      {/* Section title + courses */}
      <section className="py-10 sm:py-14 px-4 sm:px-8 md:px-12">
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div className="uimp-skel" style={{ width: 280, height: 36, marginBottom: 36 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="uimp-skel" style={{ width: '100%', height: 132, borderRadius: 16 }} />
            ))}
          </div>
        </div>
      </section>

      <p style={{ textAlign: 'center', fontFamily: sysFont, fontSize: 12, color: 'rgba(28,58,46,0.4)', paddingBottom: 24 }}>
        Завантаження…
      </p>
    </div>
  );
}
