// Мокові дані переваг
const reasons = [
  {
    id: 1,
    title: 'Практичні знання',
    description: '80% навчання - це практичні кейси, супервізії та розбори реальних випадків',
    icon: '🎯'
  },
  {
    id: 2,
    title: 'Викладачі-практики',
    description: 'Всі викладачі - діючі психотерапевти з досвідом від 10 років',
    icon: '👨‍🏫'
  },
  {
    id: 3,
    title: 'Гнучкий формат',
    description: 'Онлайн-навчання в зручний час. Доступ до матеріалів 24/7',
    icon: '💻'
  },
  {
    id: 4,
    title: 'Спільнота',
    description: 'Закрите ком\'юніті випускників, чати підтримки, нетворкінг',
    icon: '🤝'
  },
  {
    id: 5,
    title: 'Сертифікація',
    description: 'Державні сертифікати та міжнародні дипломи',
    icon: '📜'
  },
  {
    id: 6,
    title: 'Підтримка',
    description: 'Куратори відповідають на питання протягом 24 годин',
    icon: '💬'
  }
];

export default function WhyUs() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] text-center mb-4">
          Чому обирають UIMP
        </h2>
        <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
          Ми створили середовище, де теорія стає практикою, а навчання - новими можливостями
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {reasons.map((reason) => (
            <div key={reason.id} className="flex gap-4 p-6 rounded-lg hover:bg-[#E8F5E0] transition-all">
              <div className="text-4xl flex-shrink-0">{reason.icon}</div>
              <div>
                <h3 className="text-xl font-bold text-[#1C3A2E] mb-2">{reason.title}</h3>
                <p className="text-gray-600">{reason.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}