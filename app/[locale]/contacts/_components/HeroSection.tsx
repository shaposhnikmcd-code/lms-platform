import Image from 'next/image';

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

export default function HeroSection() {
  return (
    <section style={{ background: 'linear-gradient(135deg, #1C3A2E 0%, #1a3828 50%, #0f2219 100%)', paddingTop: 52, paddingBottom: 48, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 40, left: 40, width: 384, height: 384, borderRadius: '50%', backgroundColor: 'rgba(212,168,67,0.05)', filter: 'blur(60px)', pointerEvents: 'none' }} />
      <div className="container mx-auto px-4 sm:px-8 md:px-16 relative z-10">
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid rgba(212,168,67,0.25)', background: 'rgba(212,168,67,0.12)', borderRadius: 100, padding: '5px 16px', marginBottom: 20 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase' as const, color: '#D4A843', fontFamily: sysFont }}>{"UIMP"}</span>
            </div>
            <h1 style={{ fontFamily: sysFont, fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, color: 'white', lineHeight: 1.1, letterSpacing: '-0.02em', margin: '0 0 14px' }}>
              {"Про нас"}
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', maxWidth: 380, lineHeight: 1.75, margin: 0, fontFamily: sysFont }}>
              {"Дізнайтеся більше про місію та команду Українського інституту Душеопіки та Психотерапії"}
            </p>
          </div>

          <div className="hidden md:flex flex-1 justify-center">
            <div className="relative">
              <div className="absolute -inset-6 rounded-full blur-3xl opacity-20" style={{ background: 'radial-gradient(circle, #D4A843, #1C3A2E)' }} />
              <div className="relative w-52 h-52">
                <Image src="/logo.jpg" alt="UIMP Logo" fill sizes="208px" className="object-contain drop-shadow-2xl" priority />
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
