import { FaChevronRight } from 'react-icons/fa';

type Module = { number: string; title: string; color: string; items: string[] };

type Props = {
  label: string;
  title: string;
  subtitle: string;
  items: Module[];
};

export default function ModulesSection({ label, title, subtitle, items }: Props) {
  return (
    <section id="modules" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
      <div className="text-center mb-16">
        <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{label}</span>
        <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">{title}</h2>
        <p className="text-gray-500 mt-2">{subtitle}</p>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {items.map((mod, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all overflow-hidden border border-gray-100">
            <div className={`h-1.5 bg-gradient-to-r ${mod.color}`} />
            <div className="p-8">
              <div className="flex items-start gap-4 mb-6">
                <span className="text-5xl font-black text-[#1C3A2E]/10 leading-none flex-shrink-0">{mod.number}</span>
                <h3 className="text-base font-bold text-[#1C3A2E] leading-snug pt-1">{mod.title}</h3>
              </div>
              <ul className="space-y-2">
                {mod.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-3 text-gray-600">
                    <FaChevronRight className="text-[#D4A017] text-xs mt-1 flex-shrink-0" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}