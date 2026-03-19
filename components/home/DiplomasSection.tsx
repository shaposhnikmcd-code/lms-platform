'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaGraduationCap, FaCertificate, FaExternalLinkAlt, FaTimes } from 'react-icons/fa';

interface DiplomaDoc {
  type: string;
  title: string;
  org: string;
  detail: string;
  year: string;
  file: string;
  tag: string;
}

interface Props {
  content: {
    sectionLabel: string;
    docs: DiplomaDoc[];
  };
}

export default function DiplomasSection({ content }: Props) {
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const openModal = (file: string, title: string) => {
    setActiveFile(file);
    setActiveTitle(title);
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    setActiveFile(null);
    document.body.style.overflow = '';
  };

  return (
    <>
      <section className="py-16" style={{ background: 'linear-gradient(180deg, #fdf2eb 0%, #fff9f5 100%)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="flex items-center gap-4 mb-10">
            <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, rgba(212,168,67,0.4))' }} />
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full"
              style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.25)' }}>
              <FaGraduationCap className="text-[#D4A017] text-sm" />
              <span className="text-[#1C3A2E] text-xs font-semibold uppercase tracking-widest">{content.sectionLabel}</span>
            </div>
            <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, transparent, rgba(212,168,67,0.4))' }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {content.docs.map((doc, i) => (
              <button
                key={i}
                onClick={() => openModal(doc.file, doc.title)}
                className="group flex flex-col rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg text-left w-full"
                style={{ background: '#fff', border: '1px solid rgba(28,58,46,0.08)' }}
              >
                <div className="h-1 w-full"
                  style={{ background: doc.type === 'diploma'
                    ? 'linear-gradient(to right, #1C3A2E, #2a4f3f)'
                    : 'linear-gradient(to right, #D4A017, #e8b82a)' }} />
                <div className="p-5 flex flex-col gap-3 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                      style={{
                        background: doc.type === 'diploma' ? 'rgba(28,58,46,0.08)' : 'rgba(212,168,67,0.1)',
                        color: doc.type === 'diploma' ? '#1C3A2E' : '#b88913',
                      }}>
                      {doc.type === 'diploma'
                        ? <><FaGraduationCap className="inline mr-1" />{doc.tag}</>
                        : <><FaCertificate className="inline mr-1" />{doc.tag}</>}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">{doc.year}</span>
                  </div>
                  <h4 className="text-[#1C3A2E] font-bold text-sm leading-snug">{doc.title}</h4>
                  <p className="text-gray-400 text-xs leading-relaxed">{doc.org}</p>
                  <p className="text-gray-500 text-xs leading-relaxed flex-1">{doc.detail}</p>
                  <div className="flex items-center gap-1.5 text-[#D4A017] text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                    <FaExternalLinkAlt className="text-[10px]" />
                    {"Переглянути документ"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {mounted && activeFile && createPortal(
        <div
          onClick={closeModal}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '85vw', height: '88vh', borderRadius: '1rem', overflow: 'hidden',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5)', background: '#1C3A2E',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.875rem 1.5rem', borderBottom: '1px solid rgba(212,168,67,0.2)', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FaCertificate style={{ color: '#D4A017' }} />
                <span style={{ color: 'white', fontWeight: 600, fontSize: '0.875rem' }}>{activeTitle}</span>
              </div>
              <button
                onClick={closeModal}
                style={{
                  width: '2rem', height: '2rem', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', color: 'white',
                }}
              >
                <FaTimes />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <iframe
                src={`${activeFile}#toolbar=0&view=Fit&zoom=page-fit`}
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                title={activeTitle}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}