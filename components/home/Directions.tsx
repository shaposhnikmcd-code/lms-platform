import Link from 'next/link';

interface Props {
  content: {
    title: string;
    subtitle: string;
    btnAll: string;
    items: {
      title: string;
      description: string;
      icon: string;
      price: string;
      duration: string;
      link: string;
    }[];
  };
}

export default function Directions({ content }: Props) {
  return (
    <section className="py-20 bg-[#E8F5E0]">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] text-center mb-4">
          {content.title}
        </h2>
        <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
          {content.subtitle}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {content.items.map((direction, i) => (
            <Link key={i} href={direction.link} className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all group">
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
          <Link href="/courses" className="inline-block bg-[#1C3A2E] text-white px-8 py-3 rounded-lg font-semibold hover:bg-opacity-90 transition-all">
            {content.btnAll}
          </Link>
        </div>
      </div>
    </section>
  );
}