interface Props {
  content: {
    title: string;
    description: string;
    stats: { value: string; label: string }[];
  };
}

export default function About({ content }: Props) {
  return (
    <section className="py-24 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #EFE6D5 0%, #E8D5B7 50%, #EDE3D0 100%)' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#C4714A]/20 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#D4A843]/20 to-transparent" />
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full blur-3xl" style={{ background: 'rgba(196,113,74,0.08)' }} />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full blur-3xl" style={{ background: 'rgba(28,58,46,0.06)' }} />
      </div>

      <div className="relative z-10 container mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center">

          <div className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full tracking-widest uppercase mb-6" style={{ background: 'rgba(28,58,46,0.08)', color: '#1C3A2E' }}>
            <span style={{ color: '#C4714A' }}>{"◆"}</span> {"UIMP"}
          </div>

          <h2 className="text-4xl md:text-5xl font-bold mb-5 leading-tight tracking-tight" style={{ color: '#1C3A2E' }}>
            {content.title}
          </h2>

          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="w-12 h-px" style={{ background: 'rgba(196,113,74,0.4)' }} />
            <div className="w-2 h-2 rounded-full" style={{ background: '#C4714A' }} />
            <div className="w-12 h-px" style={{ background: 'rgba(196,113,74,0.4)' }} />
          </div>

          <p className="text-lg leading-relaxed mb-16 max-w-2xl mx-auto" style={{ color: 'rgba(28,58,46,0.7)' }}>
            {content.description}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {content.stats.map((stat, i) => (
              <div
                key={i}
                className="group relative rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(212,168,67,0.15)', backdropFilter: 'blur(8px)' }}
              >
                <div className="absolute top-0 left-0 w-full h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-transparent via-[#C4714A] to-transparent" />
                <div className="absolute bottom-0 right-0 w-12 h-12 rounded-full translate-x-1/2 translate-y-1/2" style={{ background: 'rgba(196,113,74,0.08)' }} />
                <div className="relative z-10">
                  <div className="text-4xl font-black mb-1 tracking-tight" style={{ color: '#1C3A2E' }}>{stat.value}</div>
                  <div className="text-xs uppercase tracking-widest font-medium" style={{ color: 'rgba(28,58,46,0.5)' }}>{stat.label}</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}