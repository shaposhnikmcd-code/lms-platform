// Skeleton під час SSR /games.
const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

function Shimmer() {
  return (
    <style>{`
      @keyframes uimpShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      .uimp-skel { background: linear-gradient(90deg, rgba(28,58,46,0.06) 0%, rgba(28,58,46,0.12) 50%, rgba(28,58,46,0.06) 100%); background-size: 200% 100%; animation: uimpShimmer 1.4s ease-in-out infinite; border-radius: 12px; }
    `}</style>
  );
}

export default function GamesLoading() {
  return (
    <main style={{ minHeight: '100vh', background: '#FAF6F0', fontFamily: sysFont }}>
      <Shimmer />
      <section style={{ padding: '64px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
          <div>
            <div className="uimp-skel" style={{ width: 140, height: 22, marginBottom: 20 }} />
            <div className="uimp-skel" style={{ width: '90%', height: 48, marginBottom: 16 }} />
            <div className="uimp-skel" style={{ width: '80%', height: 18, marginBottom: 8 }} />
            <div className="uimp-skel" style={{ width: '70%', height: 18 }} />
          </div>
          <div className="uimp-skel" style={{ width: 420, height: 420, borderRadius: 16 }} />
        </div>
      </section>
      <section style={{ padding: '32px 24px 64px' }}>
        <div className="uimp-skel" style={{ maxWidth: 900, margin: '0 auto', height: 200 }} />
      </section>
    </main>
  );
}
