import Link from 'next/link';
import Image from 'next/image';

// Мокові дані для напрямків
const directions = [
  {
    id: 1,
    title: 'Курси підвищення кваліфікації',
    description: 'Для психологів та психотерапевтів, які хочуть поглибити знання',
    link: '/courses',
    icon: '📚',
    price: 'від 3500 грн',
    duration: '3 місяці'
  },
  {
    id: 2,
    title: 'Простір турботи',
    description: 'Безкоштовні психологічні консультації для військових та їх родин',
    link: '/care-space',
    icon: '❤️',
    price: 'безкоштовно',
    duration: 'запис за 24 години'
  },
  {
    id: 3,
    title: 'База душеопікунів',
    description: 'Знайдіть спеціаліста для особистої консультації',
    link: '/counselors',
    icon: '👥',
    price: 'від 800 грн',
    duration: 'консультація 60 хв'
  },
  {
    id: 4,
    title: 'Гра "Конектор"',
    description: 'Психологічна гра для зміцнення стосунків у парі',
    link: '/links/connector',
    icon: '🎮',
    price: '1099 грн',
    duration: 'назавжди'
  }
];

export default function Directions() {
  return (
    <section className="py-20 bg-[#E8F5E0]">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] text-center mb-4">
          Наші напрямки
        </h2>
        <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
          Обирайте те, що підходить саме вам - від професійного навчання до особистої турботи
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {directions.map((direction) => (
            <Link 
              key={direction.id}
              href={direction.link}
              className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all group"
            >
              <div className="text-5xl mb-4">{direction.icon}</div>
              <h3 className="text-xl font-bold text-[#1C3A2E] mb-2 group-hover:text-[#D4A843] transition-colors">
                {direction.title}
              </h3>
              <p className="text-gray-600 mb-4 text-sm">{direction.description}</p>
              <div className="flex justify-between items-center text-sm border-t pt-4 mt-auto">
                <span className="font-semibold text-[#1C3A2E]">{direction.price}</span>
                <span className="text-gray-500">{direction.duration}</span>
              </div>
            </Link>
          ))}
        </div>
        
        <div className="text-center mt-10">
          <Link 
            href="/courses" 
            className="inline-block bg-[#1C3A2E] text-white px-8 py-3 rounded-lg font-semibold hover:bg-opacity-90 transition-all"
          >
            Всі програми та курси
          </Link>
        </div>
      </div>
    </section>
  );
}