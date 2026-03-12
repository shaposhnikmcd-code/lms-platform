export default function About() {
  // Мокові дані - потім заміниш на реальні
  const stats = [
    { value: '5+', label: 'років досвіду' },
    { value: '1000+', label: 'випускників' },
    { value: '20+', label: 'програм навчання' },
    { value: '50+', label: 'викладачів-практиків' }
  ];

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mb-6">
            Про інститут
          </h2>
          <p className="text-lg text-gray-700 mb-8">
            Український інститут психотерапії (UIMP) — це освітній простір, 
            що об'єднує професіоналів у сфері психічного здоров'я. Ми створюємо 
            якісні навчальні програми, розвиваємо спільноту та робимо психотерапію 
            доступною для кожного українця.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
            {stats.map((stat, index) => (
              <div key={index} className="p-4 bg-[#E8F5E0] rounded-lg">
                <div className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-700">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}