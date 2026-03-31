'use client';

import { FaCertificate, FaExternalLinkAlt, FaFileDownload } from 'react-icons/fa';
import { HiOutlineAcademicCap } from 'react-icons/hi';

const visionUrl = "https://www.vision.edu/web/";

const certs = [
  {
    src: '/yearly-program/Vision_International_Certificate.pdf',
    title: 'Vision International University',
    subtitle: 'Certificate in Biblical Counseling and Therapy',
    description: 'Міжнародний сертифікат від акредитованого університету Vision International University (США)',
    link: visionUrl,
    accent: '#D4A017',
  },
  {
    src: '/yearly-program/UIMP_Practical_Certificate.pdf',
    title: 'UIMP',
    subtitle: 'Практичний сертифікат',
    description: 'Сертифікат про проходження практичного курсу від Українського Інституту Мистецтва Психотерапії',
    link: null,
    accent: '#1C3A2E',
  },
];

export default function CertificatesSection() {
  const linkBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '4px',
    fontSize: '12px',
    fontWeight: 500,
    color: '#D4A843',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
  };

  return (
    <section className="py-12 bg-[#FDF2EB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

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
            <div key={i} className="flex flex-col rounded-2xl overflow-hidden bg-white shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              style={{ border: '1px solid rgba(28,58,46,0.08)' }}>
              <div className="h-1 w-full" style={{ background: `linear-gradient(to right, ${cert.accent}, ${cert.accent}cc)` }} />
              <a
                href={cert.src}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative w-full overflow-hidden text-left flex flex-col items-center justify-center"
                style={{ height: '240px', background: `linear-gradient(135deg, ${cert.accent}08, ${cert.accent}15)` }}
              >
                <div className="flex flex-col items-center gap-4 px-6 text-center">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                    style={{ background: `${cert.accent}18`, border: `2px solid ${cert.accent}30` }}>
                    <HiOutlineAcademicCap className="text-4xl" style={{ color: cert.accent }} />
                  </div>
                  <p className="text-gray-500 text-xs leading-relaxed max-w-[240px]">{cert.description}</p>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-[#1C3A2E] text-xs font-bold px-4 py-2 rounded-full">
                    <FaFileDownload style={{ fontSize: '12px' }} />
                    {"Переглянути PDF"}
                  </div>
                </div>
              </a>
              <div className="p-4 flex flex-col gap-1">
                <p className="font-bold text-[#1C3A2E] text-sm">{cert.title}</p>
                <p className="text-gray-400 text-xs">{cert.subtitle}</p>
                {cert.link && (
                  <button
                    style={linkBtnStyle}
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
  );
}