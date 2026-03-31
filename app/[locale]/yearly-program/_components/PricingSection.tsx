const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

export default function PricingSection() {
  const sendpulseUrl = "https://uimp-edu.sendpulse.online/bible-therapy";

  const sectionStyle: React.CSSProperties = { padding: '40px 48px', background: '#F5F2ED' };
  const wrapStyle: React.CSSProperties = { maxWidth: '1280px', margin: '0 auto' };
  const headStyle: React.CSSProperties = { textAlign: 'center', marginBottom: '28px' };
  const h2Style: React.CSSProperties = { fontFamily: sysFont, fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 700, color: '#1C3A2E', margin: 0, letterSpacing: '-0.02em' };
  const cardStyle: React.CSSProperties = { maxWidth: '440px', margin: '0 auto', background: 'white', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid rgba(28,58,46,0.08)' };
  const topBarStyle: React.CSSProperties = { height: '6px', background: 'linear-gradient(to right, #1C3A2E, #2a4f3f)' };
  const bodyStyle: React.CSSProperties = { padding: '28px 32px', textAlign: 'center' };
  const h3Style: React.CSSProperties = { fontFamily: sysFont, fontSize: '18px', fontWeight: 700, color: '#1C3A2E', margin: '0 0 10px' };
  const pStyle: React.CSSProperties = { fontSize: '13px', color: 'rgba(0,0,0,0.4)', lineHeight: 1.75, margin: '0 0 20px', fontFamily: sysFont };
  const dividerStyle: React.CSSProperties = { height: '1px', background: '#f0f0f0', marginBottom: '20px' };
  const btnStyle: React.CSSProperties = { display: 'block', background: '#1C3A2E', color: 'white', fontWeight: 700, padding: '12px 24px', borderRadius: '12px', textAlign: 'center', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none', fontFamily: sysFont };

  return (
    <section style={sectionStyle}>
      <div style={wrapStyle}>
        <div style={headStyle}>
          <h2 style={h2Style}>{"Вартість"}</h2>
        </div>
        <div style={cardStyle}>
          <div style={topBarStyle} />
          <div style={bodyStyle}>
            <h3 style={h3Style}>{"Ціна незабаром"}</h3>
            <p style={pStyle}>{"Ми готуємо детальну інформацію про вартість програми. Залиште заявку — і ми надішлемо вам актуальні умови першими."}</p>
            <div style={dividerStyle} />
            <a href={sendpulseUrl} target="_blank" rel="noopener noreferrer" style={btnStyle}>
              {"Заповнити анкету передреєстрації"}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}