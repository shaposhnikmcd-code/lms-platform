'use client';

import Image from 'next/image';
import { useState } from 'react';

const people = [
  {
    name: 'Тетяна Шапошник',
    role: 'Авторка програми',
    photo: '/yearly-program/Tetiana-Shaposhnyk.webp',
    education: [
      '15 років досвіду в психотерапії та душеопікунстві',
      'Авторка методу біблійної терапії',
      '300+ студентів з різних країн',
    ],
  },
  {
    name: 'Олександра Януш',
    role: 'Старша кураторка',
    photo: null,
    education: [
      '2024 — тримодульна програма "Зцілення душі через хрест"',
      '2025 — річна програма "Біблійна терапія" від UIMP',
      '2025 — університет "Бачення" (в процесі)',
    ],
  },
  {
    name: 'Анна Гудзенко',
    role: 'Кураторка',
    photo: null,
    education: [
      '2023 — курс "Зцілення душі через хрест"',
      '2024 — Транзактний аналіз (УАТА)',
      '2024 — річна програма "Біблійна терапія" в UIMP',
    ],
  },
  {
    name: 'Марта Холява',
    role: 'Кураторка',
    photo: '/yearly-program/Marta-Kholyava.jpg',
    education: [
      '2008–2014 — СНУ ім. Лесі Українки, психолог',
      '2025 — річна програма "Біблійна терапія" в UIMP',
      '2026 — Транзактний аналіз (УАТА), член УАТА',
    ],
  },
];

const initials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2);

function PersonCard({ person, index }: { person: typeof people[0]; index: number }) {
  const [hovered, setHovered] = useState(false);
  const isFounder = index === 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isFounder
          ? hovered ? 'rgba(212,168,67,0.1)' : 'rgba(212,168,67,0.06)'
          : hovered ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
        border: isFounder
          ? `1px solid ${hovered ? 'rgba(212,168,67,0.45)' : 'rgba(212,168,67,0.2)'}`
          : `1px solid ${hovered ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: '20px',
        overflow: 'hidden',
        transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
        boxShadow: hovered
          ? isFounder
            ? '0 24px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(212,168,67,0.15)'
            : '0 24px 48px rgba(0,0,0,0.35)'
          : '0 4px 16px rgba(0,0,0,0.15)',
        transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1)',
        cursor: 'pointer',
      }}
    >
      {/* Фото */}
      <div style={{ position: 'relative', height: '320px', background: 'rgba(28,46,35,0.9)', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          transform: hovered ? 'scale(1.05)' : 'scale(1)',
          transition: 'transform 0.6s cubic-bezier(0.16,1,0.3,1)',
        }}>
          {person.photo ? (
            <Image src={person.photo} alt={person.name} fill style={{ objectFit: 'cover', objectPosition: 'center top' }} sizes="480px" />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'Georgia, serif', fontSize: '60px', fontWeight: 400, color: 'rgba(212,168,67,0.25)' }}>
                {initials(person.name)}
              </span>
            </div>
          )}
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '120px', background: 'linear-gradient(to top, rgba(15,35,22,0.98), rgba(15,35,22,0.4), transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, rgba(212,168,67,${hovered ? '0.8' : '0'}), transparent)`, transition: 'all 0.4s ease', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '16px', left: '20px', right: '20px' }}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: '19px', fontWeight: 400, color: '#F5EDD6', margin: '0 0 3px', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            {person.name}
          </p>
          <p style={{ fontFamily: '-apple-system, sans-serif', fontSize: '10px', color: 'rgba(212,168,67,0.8)', margin: 0, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
            {person.role}
          </p>
        </div>
      </div>

      {/* Освіта */}
      <div style={{ padding: '16px 20px 18px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '6px' }}>
          {person.education.map((edu, j) => (
            <div key={j} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0, width: '3px', height: '3px', borderRadius: '50%', background: hovered ? '#D4A843' : 'rgba(212,168,67,0.4)', marginTop: '8px', transition: 'background 0.3s ease' }} />
              <span style={{ fontFamily: '-apple-system, sans-serif', fontSize: '12px', color: hovered ? 'rgba(245,237,214,0.7)' : 'rgba(245,237,214,0.45)', lineHeight: 1.6, transition: 'color 0.3s ease' }}>
                {edu}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TeacherSection() {
  return (
    <section style={{ background: '#1C3A2E', padding: '72px 48px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -120, right: -80, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,168,67,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -80, left: -60, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,168,67,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: '960px', margin: '0 auto', position: 'relative' }}>
        <div style={{ marginBottom: '48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div style={{ height: '1px', width: '32px', background: '#D4A843', opacity: 0.6 }} />
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.32em', textTransform: 'uppercase' as const, color: '#D4A843', fontFamily: '-apple-system, sans-serif' }}>
              {"Команда"}
            </span>
          </div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 400, color: '#F5EDD6', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            {"З вами на курсі:"}
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {people.map((person, i) => (
            <PersonCard key={i} person={person} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}