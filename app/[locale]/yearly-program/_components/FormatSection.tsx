type FormatItem = { icon: string; title: string; desc: string };

type Props = {
  label?: string;
  title: string;
  items: FormatItem[];
};

export default function FormatSection({ label, title, items }: Props) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
      <div className="text-center mb-16">
        {label && <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{label}</span>}
        <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">{title}</h2>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item, i) => (
          <div key={i} className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all border border-gray-100">
            <div className="text-4xl mb-4">{item.icon}</div>
            <h3 className="text-lg font-bold text-[#1C3A2E] mb-3">{item.title}</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}