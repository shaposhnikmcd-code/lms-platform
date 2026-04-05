import { FaArrowRight } from 'react-icons/fa';

export default function CtaSection() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
      <div className="relative bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] rounded-2xl overflow-hidden p-6 md:p-8 max-w-lg mx-auto">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-[#D4A017] rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative text-center space-y-4">
          <h2 className="text-xl md:text-2xl font-bold text-white">
            Готові вступити?
          </h2>
          <a href="#price"
            className="group inline-flex items-center justify-center gap-2 bg-[#D4A017] text-white font-bold px-8 py-3 rounded-lg hover:bg-[#b88913] transition-all">
            <span>Обрати варіант оплати</span>
            <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
      </div>
    </section>
  );
}
