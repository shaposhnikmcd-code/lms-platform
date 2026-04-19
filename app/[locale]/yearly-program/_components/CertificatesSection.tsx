'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaCertificate, FaExternalLinkAlt, FaSearchPlus } from 'react-icons/fa';
import Image from 'next/image';

const MODAL_CSS = `
@keyframes cert-overlay-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes cert-modal-in { from { opacity: 0; transform: scale(0.92) translateY(12px) } to { opacity: 1; transform: scale(1) translateY(0) } }
.cert-img-wrap::-webkit-scrollbar { display: none }
.cert-img-wrap { scrollbar-width: none; -ms-overflow-style: none }
`;

const visionUrl = "https://www.vision.edu/web/";

const certMeta = [
  { src: '/yearly-program/Vision_International_Certificate.pdf', preview: '/yearly-program/vision_cert-v3.png', link: visionUrl },
  { src: '/yearly-program/UIMP_Practical_Certificate.pdf', preview: '/yearly-program/uimp_cert-1.webp', link: null as string | null },
];

type CertItem = { title: string; subtitle: string };
type Props = {
  t: {
    label: string;
    subtitle: string;
    view: string;
    items: readonly CertItem[];
  };
};

export default function CertificatesSection({ t }: Props) {
  const certs = t.items.map((it, i) => ({ ...certMeta[i], ...it }));
  const [active, setActive] = useState<typeof certs[0] | null>(null);
  const [zoom, setZoom] = useState(1);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const open = (cert: typeof certs[0]) => {
    setActive(cert);
    document.body.style.overflow = 'hidden';
  };

  const close = useCallback(() => {
    setActive(null);
    setZoom(1);
    document.body.style.overflow = '';
  }, []);

  const imgWrapRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();
      setZoom(z => Math.min(4, Math.max(1, z + (e.deltaY < 0 ? 0.15 : -0.15))));
    };
    node.addEventListener('wheel', handler, { passive: false });
    return () => node.removeEventListener('wheel', handler);
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, close]);

  return (
    <>
      <section className="py-12 bg-[#FDF2EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="flex items-center gap-4 mb-3">
            <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, rgba(212,168,67,0.4))' }} />
            <div className="flex items-center gap-2 px-6 py-2 rounded-full"
              style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.25)' }}>
              <FaCertificate className="text-[#D4A017]" style={{ fontSize: '18px' }} />
              <span className="text-[#1C3A2E] font-semibold uppercase tracking-widest" style={{ fontSize: '18px' }}>{t.label}</span>
            </div>
            <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, transparent, rgba(212,168,67,0.4))' }} />
          </div>

          <p className="text-gray-500 text-center mb-8 max-w-xl mx-auto text-sm leading-relaxed">
            {t.subtitle}
          </p>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {certs.map((cert, i) => (
              <div key={i} className="flex flex-col">
                <button
                  onClick={() => open(cert)}
                  className="group relative w-full overflow-hidden text-left rounded-2xl aspect-[7/5] outline-none focus:outline-none focus-visible:outline-none ring-0"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <Image
                    src={cert.preview}
                    alt={cert.title}
                    fill
                    className="object-contain transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-[#1C3A2E] text-xs font-bold px-4 py-2 rounded-full flex items-center gap-2">
                      <FaSearchPlus size={12} />
                      {t.view}
                    </div>
                  </div>
                </button>
                <div className="pt-3 flex flex-col gap-1">
                  <p className="font-bold text-[#1C3A2E] text-sm">{cert.title}</p>
                  <p className="text-gray-400 text-xs">{cert.subtitle}</p>
                  {cert.link && (
                    <button
                      className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-[#D4A843] hover:underline"
                      onClick={() => window.open(cert.link!, '_blank')}
                    >
                      <FaExternalLinkAlt style={{ fontSize: '10px' }} />
                      {"vision.edu"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {mounted && active && createPortal(
        <>
          <style>{MODAL_CSS}</style>
          <div
            onClick={close}
            style={{
              position: 'fixed', inset: 0, zIndex: 999999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
              animation: 'cert-overlay-in 200ms ease forwards',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                maxHeight: '92vh', width: 'auto', maxWidth: '92vw',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                animation: 'cert-modal-in 350ms cubic-bezier(0.16,1,0.3,1) forwards',
                position: 'relative',
              }}
            >
              <button
                onClick={close}
                style={{
                  position: 'absolute', top: 8, right: 8, zIndex: 10,
                  width: 44, height: 44, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,0,0,0.5)', color: 'white',
                  border: 'none', cursor: 'pointer', fontSize: '1rem',
                }}
              >
                <FaTimes />
              </button>

              <div
                ref={imgWrapRef}
                className="cert-img-wrap"
                style={{
                  overflow: 'auto',
                  display: 'flex',
                  alignItems: zoom > 1 ? 'flex-start' : 'center',
                  justifyContent: zoom > 1 ? 'flex-start' : 'center',
                  maxHeight: '80vh',
                }}
              >
                <img
                  src={active.preview}
                  alt={active.title}
                  style={{
                    maxHeight: `calc(${zoom} * 78vh)`,
                    maxWidth: `calc(${zoom} * 88vw)`,
                    width: 'auto',
                    height: 'auto',
                    display: 'block',
                    flexShrink: 0,
                    borderRadius: 16,
                    transition: 'all 0.15s ease',
                  }}
                />
              </div>

              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <p style={{ color: 'white', fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>{active.title}</p>
                <p style={{ color: 'rgba(212,168,67,0.7)', fontSize: '0.75rem' }}>{active.subtitle}</p>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
