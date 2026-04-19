// Skeleton під час SSR /consultations. Імітує hero + список SpecialistCard.
const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

function Shimmer() {
  return (
    <style>{`
      @keyframes uimpShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      .uimp-skel { background: linear-gradient(90deg, rgba(28,58,46,0.06) 0%, rgba(28,58,46,0.12) 50%, rgba(28,58,46,0.06) 100%); background-size: 200% 100%; animation: uimpShimmer 1.4s ease-in-out infinite; border-radius: 12px; }
    `}</style>
  );
}

export default function ConsultationsLoading() {
  return (
    <main style={{ minHeight: '100vh', background: '#f4f9f4', fontFamily: sysFont }}>
      <Shimmer />
      <section style={{ background: 'linear-gradient(135deg, #1C3A2E 0%, #1a3828 50%, #0f2219 100%)', padding: '52px 24px 48px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 32 }}>
          <div style={{ flex: 1 }}>
            <div className="uimp-skel" style={{ width: 60, height: 22, marginBottom: 20, opacity: 0.25 }} />
            <div className="uimp-skel" style={{ width: '72%', height: 48, marginBottom: 14, opacity: 0.2 }} />
            <div className="uimp-skel" style={{ width: '50%', height: 14, opacity: 0.18 }} />
          </div>
          <div className="hidden md:block uimp-skel" style={{ width: 208, height: 208, borderRadius: '50%', opacity: 0.18 }} />
        </div>
      </section>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 24px' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="uimp-skel" style={{ width: '100%', height: 280, borderRadius: 18, marginBottom: 32 }} />
        ))}
      </div>
    </main>
  );
}
