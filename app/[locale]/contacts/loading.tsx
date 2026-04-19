// Skeleton під час SSR /contacts.
const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

function Shimmer() {
  return (
    <style>{`
      @keyframes uimpShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      .uimp-skel { background: linear-gradient(90deg, rgba(28,58,46,0.06) 0%, rgba(28,58,46,0.12) 50%, rgba(28,58,46,0.06) 100%); background-size: 200% 100%; animation: uimpShimmer 1.4s ease-in-out infinite; border-radius: 12px; }
    `}</style>
  );
}

export default function ContactsLoading() {
  return (
    <main style={{ minHeight: '100vh', background: '#FAF6F0', fontFamily: sysFont }}>
      <Shimmer />
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 32 }}>
          <div style={{ flex: 1 }}>
            <div className="uimp-skel" style={{ width: '60%', height: 56, marginBottom: 20 }} />
            <div className="uimp-skel" style={{ width: '80%', height: 18, marginBottom: 8 }} />
            <div className="uimp-skel" style={{ width: '70%', height: 18 }} />
          </div>
          <div className="hidden md:block uimp-skel" style={{ width: 208, height: 208, borderRadius: '50%' }} />
        </div>
      </section>
      {Array.from({ length: 3 }).map((_, i) => (
        <section key={i} style={{ padding: '48px 24px' }}>
          <div className="uimp-skel" style={{ maxWidth: 1100, margin: '0 auto', height: 240, borderRadius: 16 }} />
        </section>
      ))}
    </main>
  );
}
