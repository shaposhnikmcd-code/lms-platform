import { Link } from "@/i18n/navigation";
import Image from "next/image";

type Props = {
  href: string;
  isExternal?: boolean;
  accent: string;
  accentRgb: string;
  title: string;
  description: string;
  price: string;
  duration: string;
  freeLabel: string;
  icon?: string;
  imageSrc?: string;
};

export default function CharityCard({ href, isExternal, accent, accentRgb, title, description, price, duration, freeLabel, icon, imageSrc }: Props) {
  const inner = (
    <div className="flex flex-col flex-1" style={{ padding: '28px 24px 24px 28px' }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase' as const, color: accent, marginBottom: 18, display: 'inline-block' }}>
        {freeLabel}
      </span>
      <div className="flex items-start gap-3" style={{ marginBottom: 14 }}>
        {icon && <span style={{ fontSize: 26, flexShrink: 0, lineHeight: 1.2 }}>{icon}</span>}
        {imageSrc && (
          <div className="rounded-lg overflow-hidden relative flex-shrink-0" style={{ width: 28, height: 28 }}>
            <Image src={imageSrc} alt={title} fill className="object-cover" />
          </div>
        )}
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1C3A2E', lineHeight: 1.4, margin: 0 }}>{title}</h2>
      </div>
      <p style={{ fontSize: 13, color: 'rgba(28,58,46,0.5)', lineHeight: 1.75, flex: 1, margin: '0 0 24px', paddingLeft: 38 }}>{description}</p>
      <div className="flex items-center justify-between" style={{ paddingTop: 18, borderTop: '1px solid rgba(28,58,46,0.08)' }}>
        <p style={{ fontSize: 18, fontWeight: 800, color: accent, margin: 0 }}>{price}</p>
        <div className="flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 600, padding: '9px 16px', borderRadius: 10, background: `rgba(${accentRgb},0.09)`, color: accent }}>
          {duration}
          <svg viewBox="0 0 16 16" fill="none" width="12" height="12">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
  );

  const cardStyle = { background: 'white', border: `1px solid rgba(28,58,46,0.1)`, textDecoration: 'none', position: 'relative' as const, borderRadius: 16, overflow: 'hidden' as const, display: 'flex' as const, flexDirection: 'column' as const };
  const bar = <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent, borderRadius: '12px 0 0 12px' }} />;
  const cls = "group flex flex-col rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-xl";

  if (isExternal) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={cardStyle}>{bar}{inner}</a>;
  }
  return <Link href={href} className={cls} style={cardStyle}>{bar}{inner}</Link>;
}