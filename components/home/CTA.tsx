import { Link } from '@/i18n/navigation';

interface Props {
  content: { title: string; subtitle: string; btn: string; };
}

const stats = [
  { num: "500+", label: "підписників" },
  { num: "10+",  label: "програм" },
];

export default function CTA({ content }: Props) {
  return (
    <section
      className="py-24 relative overflow-hidden"
      style={{ background: '#FFFFFF', boxShadow: '0 6px 24px rgba(0,0,0,0.06)', position: 'relative', zIndex: 1 }}
    >
      {/* Top divider */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent 0%, #D4A843 20%, #D4A843 80%, transparent 100%)', opacity: 0.45, zIndex: 3 }} />
      {/* Bottom divider */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent 0%, #D4A843 20%, #D4A843 80%, transparent 100%)', opacity: 0.45, zIndex: 3 }} />

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-3xl" style={{ background: 'rgba(232,245,224,0.6)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full blur-2xl" style={{ background: 'rgba(212,168,67,0.06)' }} />
        <div className="absolute inset-0 opacity-[0.012]" style={{ backgroundImage: 'radial-gradient(circle, #1C3A2E 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      </div>

      <div className="relative z-10 container mx-auto px-6">
        <div className="max-w-xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full tracking-widest uppercase mb-8" style={{ background: 'rgba(28,58,46,0.06)', color: '#1C3A2E' }}>
            <span style={{ color: '#D4A843' }}>{"◆"}</span> {"UIMP"}
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 leading-tight tracking-tight" style={{ color: '#1C3A2E' }}>{content.title}</h2>
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="w-12 h-px" style={{ background: 'rgba(212,168,67,0.4)' }} />
            <div className="w-2 h-2 rounded-full" style={{ background: '#D4A843' }} />
            <div className="w-12 h-px" style={{ background: 'rgba(212,168,67,0.4)' }} />
          </div>
          <p className="text-lg mb-10 leading-relaxed" style={{ color: 'rgba(28,58,46,0.55)' }}>{content.subtitle}</p>

          <div className="flex items-center justify-center mb-10">
            {stats.map((s, i) => (
              <div key={s.num} className="flex items-center">
                {i > 0 && <div style={{ width: 1, height: 40, background: 'linear-gradient(180deg, transparent, rgba(212,168,67,0.4), transparent)', margin: '0 32px' }} />}
                <div className="text-center">
                  <span style={{ fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 300, color: '#1C3A2E', lineHeight: 1, display: 'block', letterSpacing: '-1px' }}>{s.num}</span>
                  <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'rgba(28,58,46,0.4)', display: 'block', marginTop: 4 }}>{s.label}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="relative inline-block group">
            <div className="absolute -inset-1 rounded-2xl blur opacity-20 group-hover:opacity-35 transition duration-300 bg-gradient-to-r from-[#D4A843] to-[#f0c040]" />
            <Link
              href="/courses"
              className="relative inline-flex items-center gap-3 font-bold text-base px-10 py-4 rounded-xl shadow-lg transition-all duration-300 hover:-translate-y-0.5"
              style={{ background: '#1C3A2E', color: 'white' }}
            >
              {content.btn}
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}