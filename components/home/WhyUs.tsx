interface Props {
  content: {
    title: string;
    subtitle: string;
    items: { title: string; description: string; icon: string }[];
  };
}

export default function WhyUs({ content }: Props) {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] text-center mb-4">
          {content.title}
        </h2>
        <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
          {content.subtitle}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {content.items.map((reason, i) => (
            <div key={i} className="flex gap-4 p-6 rounded-lg hover:bg-[#E8F5E0] transition-all">
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