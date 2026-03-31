import { FaChevronDown } from "react-icons/fa";

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

type Props = {
  faq: {
    label: string;
    title: string;
    items: { q: string; a: string }[];
  };
};

export default function FaqSection({ faq }: Props) {
  return (
    <section style={{ background: 'white', padding: '64px 48px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center' as const, marginBottom: 48 }}>
          <span style={{ fontFamily: sysFont, fontSize: 10, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase' as const, color: '#D4A843' }}>{faq.label}</span>
          <h2 style={{ fontFamily: sysFont, fontSize: 'clamp(24px, 3vw, 34px)', fontWeight: 700, color: '#1C3A2E', margin: '10px 0 0', letterSpacing: '-0.02em' }}>{faq.title}</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
          {faq.items.map((item, i) => (
            <details key={i} style={{ background: '#FAF6F0', borderRadius: 14, overflow: 'hidden' }}>
              <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', cursor: 'pointer', listStyle: 'none', fontFamily: sysFont, fontWeight: 600, color: '#1C3A2E', fontSize: 15 }}>
                {item.q}
                <FaChevronDown color="#9ca3af" style={{ flexShrink: 0, marginLeft: 16 }} />
              </summary>
              <div style={{ padding: '0 24px 20px', fontFamily: sysFont, fontSize: 14, color: '#4b5563', lineHeight: 1.7 }}>{item.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}