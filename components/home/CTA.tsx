import Link from 'next/link';

export default function CTA() {
  return (
    <section className="py-20 bg-[#1C3A2E]">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
          Почніть навчання вже сьогодні
        </h2>
        <p className="text-xl text-[#E8F5E0] mb-8 max-w-2xl mx-auto">
          Приєднуйтесь до спільноти професіоналів та отримайте якісну освіту в сфері психотерапії
        </p>
        
        <div className="flex flex-wrap gap-4 justify-center mb-12">
          <Link 
            href="/register" 
            className="bg-[#D4A843] text-[#1C3A2E] px-8 py-3 rounded-lg font-semibold hover:bg-opacity-90 transition-all"
          >
            Зареєструватися на курс
          </Link>
          <Link 
            href="/links" 
            className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-[#1C3A2E] transition-all"
          >
            Наші соцмережі
          </Link>
        </div>

        {/* Додаткова інформація */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto text-white">
          <div>
            <div className="text-2xl font-bold mb-2">⏰ 24/7</div>
            <div className="text-[#E8F5E0] text-sm">Доступ до матеріалів</div>
          </div>
          <div>
            <div className="text-2xl font-bold mb-2">📞 0 800 123 456</div>
            <div className="text-[#E8F5E0] text-sm">Гаряча лінія</div>
          </div>
          <div>
            <div className="text-2xl font-bold mb-2">✉️ info@uimp.ua</div>
            <div className="text-[#E8F5E0] text-sm">Електронна пошта</div>
          </div>
        </div>
      </div>
    </section>
  );
}