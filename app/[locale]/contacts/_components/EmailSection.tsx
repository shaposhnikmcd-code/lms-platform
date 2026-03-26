import { FaEnvelope } from "react-icons/fa";

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

type Props = {
  contacts: { title: string; email: string }[];
  emailResponseTime: string;
};

export default function EmailSection({ contacts, emailResponseTime }: Props) {
  return (
    <section style={{ padding: '0 48px 48px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {contacts.map((contact, i) => (
          <div key={i} style={{ background: 'white', borderRadius: 20, padding: '32px', boxShadow: '0 2px 12px rgba(28,58,46,0.06)', textAlign: 'center' as const }}>
            <div style={{ width: 52, height: 52, background: '#E8F5E0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <FaEnvelope color="#1C3A2E" size={20} />
            </div>
            <h3 style={{ fontFamily: sysFont, fontWeight: 700, color: '#1C3A2E', fontSize: 16, margin: '0 0 8px' }}>{contact.title}</h3>
            <a href={`mailto:${contact.email}`} style={{ color: '#D4A843', textDecoration: 'none', fontSize: 14 }}>{contact.email}</a>
            <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: 12, margin: '8px 0 0', fontFamily: sysFont }}>{emailResponseTime}</p>
          </div>
        ))}
      </div>
    </section>
  );
}