'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaCertificate } from 'react-icons/fa';

const certs = [
  {
    src: '/yearly-program/Vision_International_Certificate.pdf',
    title: 'Vision International University',
    subtitle: 'Certificate in Biblical Counseling and Therapy',
  },
  {
    src: '/yearly-program/UIMP_Practical_Certificate.pdf',
    title: 'UIMP',
    subtitle: 'Практичний сертифікат',
  },
];

export default function CertificatesSection() {
  const [active, setActive] = useState<{ src: string; title: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const open = (src: string, title: string) => {
    setActive({ src, title });
    document.body.style.overflow = 'hidden';
  };

  const close = () => {
    setActive(null);
    document.body.style.overflow = '';
  };

  return (
    <>
      <section className="py-12 bg-[#FDF2EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Заголовок */}
          <div className="flex items-center gap-4 mb-3">
            <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, rgba(212,168,67,0.4))' }} />
            <div className="flex items-center gap-2 px-6 py-2 rounded-full"
              style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.25)' }}>
              <FaCertificate className="text-[#D4A017]" style={{ fontSize: '18px' }} />
              <span className="text-[#1C3A2E] font-semibold uppercase tracking-widest" style={{ fontSize: '18px' }}>{"Сертифікація"}</span>
            </div>
            <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, transparent, rgba(212,168,67,0.4))' }} />
          </div>

          <p className="text-gray-500 text-center mb-8 max-w-xl mx-auto text-sm leading-relaxed">
            {"Після завершення програми ви отримуєте два сертифікати — від UIMP та від міжнародного університету"}
          </p>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {certs.map((cert, i) => (
              <button
                key={i}
                onClick={() => open(cert.src, cert.title)}
                className="group rounded-2xl overflow-hidden bg-white shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-left w-full"
                style={{ border: '1px solid rgba(28,58,46,0.08)' }}
              >
                <div className="h-1 w-full" style={{ background: 'linear-gradient(to right, #D4A017, #e8b82a)' }} />
                <div className="relative w-full overflow-hidden" style={{ height: '240px', pointerEvents: 'none' }}>
                  <iframe
                    src={`${cert.src}#toolbar=0&view=Fit&zoom=page-fit`}
                    style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                    title={cert.title}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300 flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-[#1C3A2E] text-xs font-bold px-4 py-2 rounded-full">
                      {"Переглянути"}
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <p className="font-bold text-[#1C3A2E] text-sm mb-1">{cert.title}</p>
                  <p className="text-gray-400 text-xs">{cert.subtitle}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {mounted && active && createPortal(
        <div
          onClick={close}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '85vw', height: '88vh', maxWidth: '900px', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.5)', background: '#1C3A2E', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.5rem', borderBottom: '1px solid rgba(212,168,67,0.2)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FaCertificate style={{ color: '#D4A017' }} />
                <span style={{ color: 'white', fontWeight: 600, fontSize: '0.875rem' }}>{active.title}</span>
              </div>
              <button onClick={close} style={{ width: '2rem', height: '2rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', color: 'white' }}>
                <FaTimes />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <iframe src={`${active.src}#toolbar=0&view=Fit&zoom=page-fit`} style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} title={active.title} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}