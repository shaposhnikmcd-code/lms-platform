// Skeleton під час SSR /yearly-program. Імітує hero + 4 секції-плейсхолдери.
const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

function Shimmer() {
  return (
    <style>{`
      @keyframes uimpShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      .uimp-skel { background: linear-gradient(90deg, rgba(28,58,46,0.06) 0%, rgba(28,58,46,0.12) 50%, rgba(28,58,46,0.06) 100%); background-size: 200% 100%; animation: uimpShimmer 1.4s ease-in-out infinite; border-radius: 12px; }
    `}</style>
  );
}

export default function YearlyProgramLoading() {
  return (
    <main style={{ minHeight: '100vh', background: 'white', fontFamily: sysFont }}>
      <Shimmer />
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #1C3A2E 0%, #1a3828 50%, #0f2219 100%)', padding: '80px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="uimp-skel" style={{ width: 80, height: 22, marginBottom: 24, opacity: 0.25 }} />
          <div className="uimp-skel" style={{ width: '72%', height: 56, marginBottom: 16, opacity: 0.2 }} />
          <div className="uimp-skel" style={{ width: '60%', height: 56, marginBottom: 24, opacity: 0.2 }} />
          <div className="uimp-skel" style={{ width: '55%', height: 18, opacity: 0.18 }} />
        </div>
      </section>
      {/* Section blocks */}
      {Array.from({ length: 4 }).map((_, i) => (
        <section key={i} style={{ padding: '64px 24px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div className="uimp-skel" style={{ width: 240, height: 36, marginBottom: 24 }} />
            <div className="uimp-skel" style={{ width: '100%', height: 200, borderRadius: 16 }} />
          </div>
        </section>
      ))}
    </main>
  );
}
