type Step = { step: string; title: string; desc: string };

type Props = {
  label: string;
  title: string;
  items: Step[];
};

export default function StepsSection({ title, items }: Props) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">{title}</h2>
      </div>
      <div className="relative">
        <div className="absolute top-6 left-0 right-0 h-0.5 bg-[#D4A017]/20 hidden lg:block" />
        <div className="grid md:grid-cols-5 gap-6 relative">
          {items.map((s, i) => (
            <div key={i} className="text-center relative">
              <div className="w-12 h-12 bg-[#1C3A2E] text-white rounded-full flex items-center justify-center font-bold mx-auto mb-4 relative z-10">{s.step}</div>
              <h3 className="font-bold text-[#1C3A2E] mb-2 text-sm">{s.title}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}