interface Props {
  content: {
    title: string;
    description: string;
    stats: { value: string; label: string }[];
  };
}

export default function About({ content }: Props) {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mb-6">
            {content.title}
          </h2>
          <p className="text-lg text-gray-700 mb-8">
            {content.description}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
            {content.stats.map((stat, index) => (
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