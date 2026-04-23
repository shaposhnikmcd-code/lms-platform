import { FaCheckCircle } from 'react-icons/fa';

type Props = {
  label: string;
  title: string;
  items: string[];
};

export default function OutcomesSection({ label, title, items }: Props) {
  return (
    <section
      className="py-24"
      style={{
        background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 82%, #ffffff 100%), radial-gradient(ellipse 90% 90% at center, #E8DBBC 0%, #F0E6CF 20%, #FAF6F0 50%, #ffffff 100%)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">{label}</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">{title}</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((o, i) => (
            <div key={i} className="flex items-start gap-3 bg-white p-5 rounded-xl shadow-sm border border-white hover:border-[#D4A017]/30 transition-all hover:shadow-md">
              <FaCheckCircle className="text-[#D4A017] text-xl flex-shrink-0 mt-0.5" />
              <p className="text-gray-700 text-sm">{o}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}