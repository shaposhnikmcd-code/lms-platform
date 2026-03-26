export default function CtaSection() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
      <div className="relative bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] rounded-2xl overflow-hidden p-6 md:p-8 max-w-lg mx-auto">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-[#D4A017] rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative text-center">
          <h2 className="text-xl md:text-2xl font-bold text-white">
            {"Реєстрація буде відкрита незабаром"}
          </h2>
        </div>
      </div>
    </section>
  );
}