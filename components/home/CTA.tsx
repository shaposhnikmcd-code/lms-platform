import { Link } from '@/i18n/navigation';

interface Props {
  content: { title: string; subtitle: string; btn: string; };
}

const stats = [
  { num: "500+", label: "випускників" },
  { num: "10+",  label: "програм" },
];

export default function CTA({ content }: Props) {
  return (
    <section className="py-14 relative overflow-hidden" style={{ background: '#FFFFFF', position: 'relative', zIndex: 1 }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full blur-3xl" style={{ background: 'rgba(232,245,224,0.6)' }} />
      </div>

      <div className="relative z-10 container mx-auto px-6">
        <div className="max-w-xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-xs font-bold px-4 py-1.5 rounded-full tracking-widest uppercase mb-5" style={{ background: 'rgba(28,58,46,0.06)', color: '#1C3A2E' }}>
            {"UIMP"}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-3 leading-tight tracking-tight" style={{ color: '#1C3A2E', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>{content.title}</h2>
          <p className="text-base mb-7 leading-relaxed" style={{ color: 'rgba(28,58,46,0.55)', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>{content.subtitle}</p>

          <div className="flex items-center justify-center mb-7">
            {stats.map((s, i) => (
              <div key={s.num} className="flex items-center">
                {i > 0 && <div style={{ width: 1, height: 32, background: 'linear-gradient(180deg, transparent, rgba(212,168,67,0.4), transparent)', margin: '0 24px' }} />}
                <div className="text-center">
                  <span style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontSize: 30, fontWeight: 700, color: '#1C3A2E', lineHeight: 1, display: 'block', letterSpacing: '-1px' }}>{s.num}</span>
                  <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'rgba(28,58,46,0.4)', display: 'block', marginTop: 3 }}>{s.label}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="relative inline-block group">
            <div className="absolute -inset-1 rounded-2xl blur opacity-20 group-hover:opacity-35 transition duration-300 bg-gradient-to-r from-[#D4A843] to-[#f0c040]" />
            <Link
              href="/courses"
              className="relative inline-flex items-center gap-3 font-bold text-base px-9 py-3.5 rounded-xl shadow-lg transition-all duration-300 hover:-translate-y-0.5"
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