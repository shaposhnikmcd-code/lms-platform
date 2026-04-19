// Skeleton під час SSR /news. Імітує hero + grid карток.

function Shimmer() {
  return (
    <style>{`
      @keyframes uimpShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      .uimp-skel { background: linear-gradient(90deg, rgba(28,58,46,0.06) 0%, rgba(28,58,46,0.12) 50%, rgba(28,58,46,0.06) 100%); background-size: 200% 100%; animation: uimpShimmer 1.4s ease-in-out infinite; border-radius: 12px; }
    `}</style>
  );
}

export default function NewsLoading() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Shimmer />
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] text-white py-20">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="uimp-skel mx-auto" style={{ width: '60%', maxWidth: 480, height: 48, marginBottom: 16, opacity: 0.25 }} />
          <div className="uimp-skel mx-auto" style={{ width: '40%', maxWidth: 320, height: 22, opacity: 0.2 }} />
        </div>
      </section>
      {/* Grid */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="uimp-skel" style={{ width: '100%', height: 192, borderRadius: 0 }} />
              <div className="p-6">
                <div className="uimp-skel" style={{ width: 80, height: 22, marginBottom: 12 }} />
                <div className="uimp-skel" style={{ width: '90%', height: 22, marginBottom: 8 }} />
                <div className="uimp-skel" style={{ width: '70%', height: 22, marginBottom: 16 }} />
                <div className="uimp-skel" style={{ width: '100%', height: 14, marginBottom: 6 }} />
                <div className="uimp-skel" style={{ width: '85%', height: 14, marginBottom: 16 }} />
                <div className="uimp-skel" style={{ width: 140, height: 12 }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
