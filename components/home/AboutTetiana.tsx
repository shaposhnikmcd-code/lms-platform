'use client';

import Image from 'next/image';
import { FaQuoteLeft, FaQuoteRight, FaHeart, FaBrain, FaUsers, FaPray } from 'react-icons/fa';
import DiplomasSection from './DiplomasSection';

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
    name: string;
    role: string;
    experience: string;
    quote: string;
    aboutTitle: string;
    aboutText: string;
    worksWithTitle: string;
    specializations: { text: string; icon: string }[];
    diplomas: string;
    certificates: string;
    videosTitle: string;
    consultationTitle: string;
    consultationSubtitle: string;
    socialTitle: string;
    socialSubtitle: string;
    videos: { videoId: string; title: string }[];
    diplomasSection: { sectionLabel: string; docs: DiplomaDoc[] };
  };
}

const iconMap: Record<string, React.ReactNode> = {
  brain: <FaBrain />,
  heart: <FaHeart />,
  users: <FaUsers />,
  pray: <FaPray />,
};

export default function AboutTetiana({ content }: Props) {
  return (
    <section className="relative py-24 overflow-hidden bg-gradient-to-b from-white to-[#FDF2EB]">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-40 left-20 w-72 h-72 bg-[#D4A017] rounded-full blur-3xl"></div>
        <div className="absolute bottom-40 right-20 w-72 h-72 bg-[#1C3A2E] rounded-full blur-3xl"></div>
      </div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-[#1C3A2E] mt-2">{content.name}</h2>
          <p className="text-gray-500 text-lg mt-3 max-w-2xl mx-auto">{content.role}</p>
        </div>
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div className="space-y-8">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#D4A017] to-[#1C3A2E] rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
              <div className="relative bg-white p-2 rounded-3xl shadow-2xl">
                <div className="relative h-[500px] w-full rounded-2xl overflow-hidden">
                  <Image src="/Tetiana-Shaposhnyk/Tetiana-Shaposhnyk.webp" alt={content.name} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover object-top" priority />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-8 bg-[#D4A017] rounded-full"></div>
                      <p className="text-2xl font-bold">{content.name}</p>
                    </div>
                    <p className="text-white/80 text-sm">{content.experience}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-8">
            <div className="relative bg-white rounded-2xl shadow-xl p-8">
              <FaQuoteLeft className="absolute top-4 left-4 text-4xl text-[#D4A017] opacity-20" />
              <FaQuoteRight className="absolute bottom-4 right-4 text-4xl text-[#D4A017] opacity-20" />
              <p className="text-gray-600 italic text-lg leading-relaxed relative z-10">{`"${content.quote}"`}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-bold text-[#1C3A2E] mb-4">{content.aboutTitle}</h3>
              <p className="text-gray-600 leading-relaxed">{content.aboutText}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-bold text-[#1C3A2E] mb-6">{content.worksWithTitle}</h3>
              <div className="grid grid-cols-2 gap-4">
                {content.specializations.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-[#FDF2EB] rounded-xl hover:bg-[#D4A017]/10 transition-colors group">
                    <div className="text-[#D4A017] text-xl group-hover:scale-110 transition-transform">{iconMap[item.icon]}</div>
                    <p className="text-sm text-gray-700">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-16">
          <DiplomasSection content={content.diplomasSection} />
        </div>
        <div className="mt-16">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h3 className="text-2xl font-bold text-[#1C3A2E] mb-6">{content.videosTitle}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {content.videos.map((video, i) => (
                <div key={i} className="space-y-3">
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black shadow-lg">
                    <iframe src={`https://www.youtube.com/embed/${video.videoId}`} title={video.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="absolute inset-0 w-full h-full"></iframe>
                  </div>
                  <p className="text-sm text-gray-700 font-medium line-clamp-2">{video.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-16 flex justify-center">
          <a href="https://calendly.com/saposniktana878/50" target="_blank" rel="noopener noreferrer"
            className="group block bg-gradient-to-r from-[#1C3A2E] to-[#2a4f3f] rounded-2xl p-8 text-center hover:shadow-2xl transition-all max-w-2xl w-full">
            <div className="inline-block p-4 bg-[#D4A017] rounded-full mb-4 group-hover:scale-110 transition-transform">
              <FaHeart className="text-white text-2xl" />
            </div>
            <h4 className="text-2xl font-bold text-white mb-2">{content.consultationTitle}</h4>
            <p className="text-white/80 text-sm">{content.consultationSubtitle}</p>
          </a>
        </div>
      </div>
    </section>
  );
}