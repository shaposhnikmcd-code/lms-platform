"use client";

import { Link } from "@/i18n/navigation";

const arrowD = "M3 8h10M9 4l4 4-4 4";

type Props = {
  label: string;
  title: string;
  desc: string;
  btn: string;
};

export default function SupportCard({ label, title, desc, btn }: Props) {
  return (
    <div
      className="relative rounded-3xl overflow-hidden flex flex-col md:flex-row items-center gap-8 px-10 py-10"
      style={{ background: 'white', border: '1px solid rgba(212,168,67,0.35)', boxShadow: '0 8px 40px rgba(28,58,46,0.08)' }}
    >
      <div className="absolute top-0 left-0 right-0 h-0.5 pointer-events-none" style={{ background: 'linear-gradient(to right, transparent 5%, #D4A843 50%, transparent 95%)' }} />
      <div className="absolute top-0 left-0 w-16 h-16 pointer-events-none" style={{ background: 'radial-gradient(circle at top left, rgba(212,168,67,0.08), transparent 70%)' }} />
      <div className="absolute bottom-0 right-0 w-24 h-24 pointer-events-none" style={{ background: 'radial-gradient(circle at bottom right, rgba(28,58,46,0.05), transparent 70%)' }} />

      <div className="relative z-10 flex-1 text-center md:text-left">
        <div className="flex items-center gap-3 justify-center md:justify-start mb-4">
          <div style={{ width: 24, height: 1, background: 'rgba(212,168,67,0.7)' }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase' as const, color: '#D4A843' }}>{label}</span>
        </div>
        <h3 className="text-2xl md:text-3xl font-bold mb-2 leading-tight" style={{ color: '#1C3A2E' }}>{title}</h3>
        <p style={{ fontSize: 14, color: 'rgba(28,58,46,0.5)', fontWeight: 300 }}>{desc}</p>
      </div>

      <div className="relative z-10 flex-shrink-0">
        <Link
          href="https://t.me/uimp_support"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-3 font-semibold px-7 py-3.5 rounded-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
          style={{ background: '#1C3A2E', color: '#D4A843', boxShadow: '0 4px 16px rgba(28,58,46,0.2)' }}
        >
          {"💬"} {btn}
          <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1">
            <path d={arrowD} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </div>
    </div>
  );
}