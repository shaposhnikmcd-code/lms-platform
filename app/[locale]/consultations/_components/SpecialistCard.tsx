import Image from "next/image";
import { Link } from "@/i18n/navigation";
import DiplomasList from "./DiplomasList";

interface Specialization {
  icon: string;
  text: string;
}

interface DiplomaDoc {
  type: string;
  title: string;
  org: string;
  detail: string;
  year: string;
  file: string;
  tag: string;
}

interface Specialist {
  name: string;
  role: string;
  experience: string;
  image: string;
  price: string;
  duration: string;
  about: string;
  specializations: Specialization[];
  diplomas: DiplomaDoc[];
  calendlyUrl: string;
}

interface Labels {
  aboutTitle: string;
  worksWithTitle: string;
  diplomasLabel: string;
  costLabel: string;
  durationLabel: string;
  btnBook: string;
}

interface Props {
  s: Specialist;
  labels: Labels;
}

export default function SpecialistCard({ s, labels }: Props) {
  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 0.9fr' }}>

        {/* Колонка 1: Фото */}
        <div className="relative" style={{ borderRight: '1px solid #f3f4f6' }}>
          <div className="relative h-72 lg:h-full min-h-[400px] w-full overflow-hidden">
            <Image
              src={s.image}
              alt={s.name}
              fill
              sizes="(max-width: 1024px) 100vw, 25vw"
              className="object-cover object-top"
              priority
              quality={100}
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1 h-6 bg-[#D4A843] rounded-full" />
                <p className="text-xl font-bold">{s.name}</p>
              </div>
              <p className="text-white/70 text-sm pl-3">{s.role}</p>
              <div className="flex items-center gap-2 mt-2 pl-3">
                <div className="w-1.5 h-1.5 bg-[#D4A843] rounded-full" />
                <p className="text-[#D4A843] text-xs font-medium">{s.experience}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Колонка 2: Середина */}
        <div className="flex flex-col">
          <div className="grid grid-cols-2 gap-0" style={{ borderBottom: '1px solid #f3f4f6' }}>

            {/* Про фахівця */}
            <div className="px-6 py-5" style={{ borderRight: '1px solid #f3f4f6' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-0.5 bg-[#D4A843]" />
                <h3 className="text-xs font-bold text-[#1C3A2E] uppercase tracking-widest">{labels.aboutTitle}</h3>
              </div>
              <p style={{
                color: '#374151',
                fontSize: '0.8rem',
                lineHeight: 1.75,
                fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                fontWeight: 450,
                letterSpacing: '0.01em',
              }}>
                {s.about}
              </p>
            </div>

            {/* Працює з */}
            <div className="px-6 py-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-0.5 bg-[#D4A843]" />
                <h3 className="text-xs font-bold text-[#1C3A2E] uppercase tracking-widest">{labels.worksWithTitle}</h3>
              </div>
              <div className="flex flex-col gap-1.5">
                {s.specializations.map((spec, j) => (
                  <div key={j} className="flex items-center gap-2 p-2 bg-[#f4f9f4] rounded-lg">
                    <span className="text-sm flex-shrink-0">{spec.icon}</span>
                    <p className="text-xs text-gray-700 font-medium leading-tight">{spec.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Освіта та кваліфікація */}
          <div className="px-6 py-5 flex-1 bg-[#fafbfa]">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-0.5 bg-[#D4A843]" />
              <h3 className="text-xs font-bold text-[#1C3A2E] uppercase tracking-widest">{labels.diplomasLabel}</h3>
            </div>
            <DiplomasList docs={s.diplomas} />
          </div>
        </div>

        {/* Колонка 3: Ціна */}
        <div className="flex flex-col" style={{ borderLeft: '1px solid #f3f4f6' }}>
          <div className="h-1 bg-gradient-to-r from-[#D4A843] via-[#f0c040] to-[#D4A843]" />
          <div className="px-6 py-8 flex flex-col flex-1 justify-center gap-6">
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-2 font-medium">{labels.costLabel}</p>
              <p className="text-4xl font-bold text-[#1C3A2E] tracking-tight">{s.price}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-100" />
              <div className="w-1.5 h-1.5 bg-[#D4A843] rounded-full" />
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-2 font-medium">{labels.durationLabel}</p>
              <p className="text-sm font-medium text-gray-500">{s.duration}</p>
            </div>
            <Link
              href={s.calendlyUrl}
              target="_blank"
              className="block w-full bg-[#1C3A2E] text-white font-semibold py-4 rounded-xl text-center text-sm tracking-widest uppercase transition-all hover:bg-[#D4A843] hover:text-[#1C3A2E]"
            >
              {labels.btnBook}
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}