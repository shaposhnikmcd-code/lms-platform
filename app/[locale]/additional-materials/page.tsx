const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

export default function AdditionalMaterialsPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#FAF6F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' as const }}>
        <h1 style={{ fontFamily: sysFont, fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, color: '#1C3A2E', margin: '0 0 16px', letterSpacing: '-0.02em' }}>
          {"Додаткові матеріали"}
        </h1>
        <p style={{ fontFamily: sysFont, fontSize: '14px', color: 'rgba(28,58,46,0.4)' }}>
          {"Сторінка в розробці"}
        </p>
      </div>
    </main>
  );
}