// Skeleton під час SSR-rendering /courses. Без нього користувач бачить
// білий екран до завершення Prisma-запитів і next-intl.
// Структура повторює основні секції page.tsx (hero + список курсів + пакети) —
// щоб не було layout-shift при появі реального контенту І щоб browser
// scroll-restoration коректно працював при reload-і (інакше фолбек коротший
// за реальну сторінку → browser clamp-ить scroll до низу скелета і відновлення
// до позиції користувача втрачається).
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

      {/* Bundles section skeleton — резервує ≈ реальну висоту секції пакетів,
          щоб browser scroll-restoration на reload відпрацював коректно для
          користувачів, які скролять до пакетів. Висота 2 рядів × 920px (Models
          M5/M11) + header ≈ 2040px. Якщо в реальності 1 ряд — буде невеликий
          layout-shift (-920px), що краще ніж reset скролу до початку. */}
      <section className="pt-0 sm:pt-2 pb-10 sm:pb-12 px-2 sm:px-3 md:px-4">
        <div style={{ maxWidth: 1920, margin: '0 auto' }}>
          <div style={{ maxWidth: 860, margin: '0 auto 36px' }}>
            <div className="uimp-skel" style={{ width: 120, height: 22, borderRadius: 100, marginBottom: 14, opacity: 0.4 }} />
            <div className="uimp-skel" style={{ width: 360, height: 36, marginBottom: 8 }} />
            <div className="uimp-skel" style={{ width: 240, height: 14, opacity: 0.5 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex flex-wrap gap-4 items-start justify-center">
                <div className="uimp-skel" style={{ width: 730, maxWidth: '100%', height: 920, borderRadius: 24 }} />
                <div className="uimp-skel" style={{ width: 730, maxWidth: '100%', height: 920, borderRadius: 24 }} />
              </div>
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
