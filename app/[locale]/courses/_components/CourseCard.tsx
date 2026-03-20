import { Link } from "@/i18n/navigation";

type Props = {
  href: string;
  accent: string;
  accentRgb: string;
  tag: string;
  icon: string;
  title: string;
  description: string;
  price: string | number;
  duration: string;
  currency: string;
  priceLabel: string;
  dark?: boolean;
};

export default function CourseCard({ href, accent, accentRgb, tag, icon, title, description, price, duration, currency, priceLabel, dark }: Props) {
  const bg = dark ? 'rgba(255,255,255,0.04)' : 'white';
  const titleColor = dark ? 'white' : '#1C3A2E';
  const descColor = dark ? 'rgba(255,255,255,0.45)' : 'rgba(28,58,46,0.5)';
  const borderColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(28,58,46,0.07)';
  const labelColor = dark ? 'rgba(255,255,255,0.3)' : 'rgba(28,58,46,0.3)';

  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
      style={{ background: bg, border: `1px solid ${borderColor}`, textDecoration: 'none', position: 'relative' }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent, borderRadius: '12px 0 0 12px' }} />
      <div className="flex flex-col flex-1" style={{ padding: '28px 24px 24px 28px' }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase' as const, color: accent, marginBottom: 18, display: 'inline-block' }}>
          {tag}
        </span>
        <div className="flex items-start gap-3" style={{ marginBottom: 14 }}>
          <span style={{ fontSize: 26, flexShrink: 0, lineHeight: 1.2 }}>{icon}</span>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: titleColor, lineHeight: 1.4, margin: 0 }}>{title}</h2>
        </div>
        <p style={{ fontSize: 13, color: descColor, lineHeight: 1.75, flex: 1, margin: '0 0 24px', paddingLeft: 38 }}>{description}</p>
        <div className="flex items-center justify-between" style={{ paddingTop: 18, borderTop: `1px solid ${borderColor}` }}>
          <div>
            <p style={{ fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.2em', color: labelColor, margin: '0 0 4px' }}>{priceLabel}</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: accent, margin: 0 }}>{price} {currency}</p>
          </div>
          <div className="flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 600, padding: '9px 16px', borderRadius: 10, background: `rgba(${accentRgb},0.08)`, color: accent }}>
            {duration}
            <svg viewBox="0 0 16 16" fill="none" width="12" height="12">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}