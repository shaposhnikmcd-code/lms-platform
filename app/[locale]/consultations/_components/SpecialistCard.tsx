import Image from "next/image";
import { Link } from "@/i18n/navigation";
import DiplomasList, { DiplomaDoc } from "./DiplomasList";
import EducationTimeline, { EducationCategory } from "./EducationTimeline";
import CertificatesGrid, { CertificateDoc } from "./CertificatesGrid";

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

interface Specialization {
  icon: string;
  text: string;
}


interface Specialist {
  slug: string;
  name: string;
  role: string;
  experience: string;
  image?: string;
  imagePosition?: string;
  price: string;
  duration: string;
  about: string;
  specializations: Specialization[];
  diplomas?: DiplomaDoc[];
  education?: EducationCategory[];
  certificates?: CertificateDoc[];
  associations?: { short: string; full: string }[];
  calendlyUrl: string;
  btnLabel?: string;
  hidden?: boolean;
}

interface Labels {
  aboutTitle: string;
  worksWithTitle: string;
  diplomasLabel: string;
  educationTitle?: string;
  certificatesTitle?: string;
  associationsLabel?: string;
  costLabel: string;
  durationLabel: string;
  btnBook: string;
}

interface Props {
  s: Specialist;
  labels: Labels;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{ width: 12, height: 2, background: '#D4A843', flexShrink: 0 }} />
      <h3 style={{
        fontSize: '0.63rem',
        fontWeight: 700,
        color: '#1C3A2E',
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        margin: 0,
        fontFamily: sysFont,
      }}>
        {title}
      </h3>
    </div>
  );
}

export default function SpecialistCard({ s, labels }: Props) {
  const hasNewFormat = !!s.education;

  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
      {/* Золота лінія зверху */}
      <div style={{ height: 2, background: 'linear-gradient(90deg, #D4A843 0%, #f0c040 50%, #D4A843 100%)' }} />

      <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_2.75fr]">

        {/* Колонка 1: Фото + Ціна */}
        <div className="flex flex-col border-b lg:border-b-0 lg:border-r border-gray-100">

          {/* Фото — займає весь простір вище ціни */}
          <div className="relative flex-1 overflow-hidden" style={{ minHeight: 240 }}>
            {s.image ? (
              <Image
                src={s.image}
                alt={s.name}
                fill
                sizes="(max-width: 1024px) 100vw, 22vw"
                className="object-cover"
                style={{ objectPosition: s.imagePosition ?? 'center top' }}
                priority
                quality={100}
                unoptimized
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#1C3A2E] to-[#0f2219] flex items-center justify-center">
                <span style={{ fontSize: '4rem', fontWeight: 700, color: 'rgba(212,168,67,0.3)', fontFamily: sysFont, userSelect: 'none' }}>
                  {s.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </span>
              </div>
            )}
            {/* Градієнт знизу + ім'я */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              <div className="flex items-center gap-2 mb-0.5">
                <div className="w-0.5 h-5 bg-[#D4A843] rounded-full" />
                <p className="text-base font-bold leading-tight">{s.name}</p>
              </div>
              <p className="text-white/60 text-xs pl-3">{s.role}</p>
              {s.experience && (
                <div className="flex items-center gap-1.5 mt-1 pl-3">
                  <div className="w-1 h-1 bg-[#D4A843] rounded-full" />
                  <p className="text-[#D4A843] text-xs font-medium">{s.experience}</p>
                </div>
              )}
            </div>
          </div>

          {/* Ціна — темно-зелений блок, продовжує фото */}
          <div style={{ background: '#1C3A2E', padding: '16px 20px', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
              <div>
                <p style={{ fontSize: '0.53rem', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 3px', fontFamily: sysFont }}>
                  {labels.costLabel}
                </p>
                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'white', margin: 0, lineHeight: 1, fontFamily: sysFont }}>
                  {s.price}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '0.53rem', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 3px', fontFamily: sysFont }}>
                  {labels.durationLabel}
                </p>
                <p style={{ fontSize: '0.8rem', fontWeight: 500, color: 'rgba(255,255,255,0.65)', margin: 0, fontFamily: sysFont }}>
                  {s.duration}
                </p>
              </div>
            </div>
            <Link
              href={s.calendlyUrl}
              target="_blank"
              className="block w-full text-center font-semibold transition-all duration-150 hover:opacity-90"
              style={{
                background: '#D4A843',
                color: '#1C3A2E',
                padding: '10px 16px',
                borderRadius: 8,
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                fontFamily: sysFont,
              }}
            >
              {s.btnLabel || labels.btnBook}
            </Link>
          </div>
        </div>

        {/* Колонка 2: Контент */}
        <div className="flex flex-col">

          {/* Верхній ряд: Про фахівця | Працює з */}
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ borderBottom: '1px solid #f3f4f6' }}>
            <div className="px-5 py-4 border-b sm:border-b-0 sm:border-r border-gray-100">
              <SectionHeader title={labels.aboutTitle} />
              <p style={{
                color: '#374151',
                fontSize: '0.77rem',
                lineHeight: 1.7,
                fontFamily: sysFont,
                fontWeight: 450,
                letterSpacing: '0.01em',
                margin: 0,
              }}>
                {s.about}
              </p>
            </div>

            <div className="px-5 py-4">
              <SectionHeader title={labels.worksWithTitle} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {s.specializations.map((spec, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 8px', background: '#f4f9f4', borderRadius: 7 }}>
                    <span style={{ fontSize: '0.8rem', flexShrink: 0 }}>{spec.icon}</span>
                    <p style={{ fontSize: '0.71rem', color: '#374151', fontWeight: 500, margin: 0, lineHeight: 1.3, fontFamily: sysFont }}>{spec.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Нижній ряд: Освіта | Сертифікати  або  Дипломи */}
          <div className="px-5 py-4 flex-1 bg-[#fafbfa]">
            {hasNewFormat ? (() => {
              const inlineCategories = s.education!.filter(c => !c.fullWidth);
              const fullWidthCategories = s.education!.filter(c => c.fullWidth);
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Спліт: Освіта | Сертифікати */}
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-[1.1rem]">
                    <div className="sm:basis-[52%] min-w-0">
                      <SectionHeader title={labels.educationTitle ?? 'Education and training'} />
                      <EducationTimeline categories={inlineCategories} />
                    </div>

                    <div className="hidden sm:block self-stretch" style={{ width: 1, background: 'rgba(28,58,46,0.07)', flexShrink: 0 }} />

                    {s.certificates && s.certificates.length > 0 && (
                      <div className="flex-1 min-w-0 flex flex-col gap-[0.65rem]">
                        <div>
                          <SectionHeader title={labels.certificatesTitle ?? 'Certificates'} />
                          <CertificatesGrid certs={s.certificates} />
                        </div>
                        {s.associations && s.associations.length > 0 && (
                          <div style={{ borderTop: '1px dashed rgba(28,58,46,0.1)', paddingTop: '0.45rem' }}>
                            <p style={{ fontSize: '0.56rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', fontFamily: sysFont, margin: '0 0 0.3rem' }}>
                              {labels.associationsLabel ?? "Membership in associations"}
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              {s.associations.map((a, ai) => (
                                <div key={ai} style={{ padding: '4px 8px', borderLeft: '3px solid #1C3A2E', borderTop: '1px solid rgba(28,58,46,0.07)', borderRight: '1px solid rgba(28,58,46,0.07)', borderBottom: '1px solid rgba(28,58,46,0.07)', background: 'white' }}>
                                  <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#1C3A2E', fontFamily: sysFont, margin: 0, lineHeight: 1.2 }}>{a.short}</p>
                                  <p style={{ fontSize: '0.59rem', color: '#6b7280', fontFamily: sysFont, margin: '1px 0 0', lineHeight: 1.3 }}>{a.full}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Повна ширина: Теологічна освіта */}
                  {fullWidthCategories.length > 0 && (
                    <div style={{ borderTop: '1px solid rgba(28,58,46,0.07)', paddingTop: '0.65rem' }}>
                      <EducationTimeline categories={fullWidthCategories} twoColumn />
                    </div>
                  )}
                </div>
              );
            })() : (
              <>
                <SectionHeader title={labels.diplomasLabel} />
                <DiplomasList docs={s.diplomas ?? []} />
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
