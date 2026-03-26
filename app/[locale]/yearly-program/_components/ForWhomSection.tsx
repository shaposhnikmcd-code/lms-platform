const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

type Props = {
  title: string;
  items: string[];
};

export default function ForWhomSection({ title, items }: Props) {
  return (
    <section style={{ background: '#FAF6F0', padding: '72px 48px' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>

        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ height: '1px', width: '28px', background: '#D4A843' }} />
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.32em', textTransform: 'uppercase' as const, color: '#D4A843', fontFamily: sysFont }}>
              {"Аудиторія"}
            </span>
          </div>
          <h2 style={{ fontFamily: sysFont, fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 700, color: '#1C3A2E', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            {title}
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
          {items.map((item, i) => (
            <div
              key={i}
              style={{
                position: 'relative' as const,
                display: 'flex',
                alignItems: 'center',
                background: 'white',
                borderRadius: '12px',
                padding: '16px 24px',
                border: '1px solid rgba(28,58,46,0.07)',
                gap: '20px',
                overflow: 'hidden',
              }}
            >
              <span style={{
                position: 'absolute' as const,
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontFamily: sysFont,
                fontSize: '48px',
                fontWeight: 700,
                color: 'rgba(212,168,67,0.1)',
                lineHeight: 1,
                letterSpacing: '-0.04em',
                userSelect: 'none' as const,
                pointerEvents: 'none' as const,
              }}>
                {String(i + 1).padStart(2, '0')}
              </span>

              <div style={{
                flexShrink: 0,
                width: '3px',
                height: '32px',
                background: 'linear-gradient(to bottom, #D4A843, rgba(212,168,67,0.2))',
                borderRadius: '2px',
              }} />

              <p style={{
                fontFamily: sysFont,
                fontSize: '17px',
                color: '#1C3A2E',
                lineHeight: 1.5,
                margin: 0,
                letterSpacing: '-0.01em',
                fontWeight: 400,
                paddingRight: '80px',
              }}>
                {item.replace(/[;.]$/, '')}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}