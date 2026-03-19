import Link from 'next/link';

interface Props {
  content: {
    title: string;
    subtitle: string;
    btn: string;
  };
}

export default function CTA({ content }: Props) {
  return (
    <section className="bg-[#D4A017] py-16">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          {content.title}
        </h2>
        <p className="text-white/90 text-lg mb-8 max-w-2xl mx-auto">
          {content.subtitle}
        </p>
        <Link href="/courses" className="bg-[#1C3A2E] text-white px-8 py-3 rounded-lg font-semibold hover:bg-[#2a4f3f] transition-all">
          {content.btn}
        </Link>
      </div>
    </section>
  );
}