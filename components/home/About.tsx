interface Props {
  content: {
    title: string;
    description: string;
    stats: { value: string; label: string }[];
  };
}

export default function About({ content }: Props) {
  return (
    <section className="py-24 relative overflow-hidden" style={{ background: '#FAF6F0' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#D4A843]/20 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#D4A843]/20 to-transparent" />
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-[#D4A843]/6 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-[#1C3A2E]/4 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">

          <div className="inline-flex items-center gap-2 bg-[#1C3A2E]/8 text-[#1C3A2E] text-xs font-bold px-4 py-2 rounded-full tracking-widest uppercase mb-6">
            <span style={{ color: '#D4A843' }}>{"◆"}</span> {"UIMP"}
          </div>

          <h2 className="text-4xl md:text-5xl font-bold text-[#1C3A2E] mb-5 leading-tight tracking-tight">
            {content.title}
          </h2>

          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="w-12 h-px bg-[#D4A843]/40" />
            <div className="w-2 h-2 bg-[#D4A843] rounded-full" />
            <div className="w-12 h-px bg-[#D4A843]/40" />
          </div>

          <p className="text-gray-600 text-lg leading-relaxed mb-16 max-w-2xl mx-auto">
            {content.description}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {content.stats.map((stat, i) => (
              <div
                key={i}
                className="group relative bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                style={{ border: '1px solid rgba(212,168,67,0.12)' }}
              >
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#D4A843] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute bottom-0 right-0 w-16 h-16 bg-[#D4A843]/5 rounded-full translate-x-1/2 translate-y-1/2" />
                <div className="relative z-10">
                  <div className="text-4xl font-black text-[#1C3A2E] mb-1 tracking-tight">{stat.value}</div>
                  <div className="text-xs text-gray-400 uppercase tracking-widest font-medium">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}