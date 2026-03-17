'use client';

import { FaGraduationCap } from 'react-icons/fa';

interface SendPulseButtonProps {
  url: string;
}

export default function SendPulseButton({ url }: SendPulseButtonProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-3 bg-[#D4A017] text-white font-bold py-5 px-12 rounded-xl hover:bg-[#b88913] transition-all text-lg w-full justify-center"
    >
      <FaGraduationCap className="text-xl" />
      {"Купити курс"}
    </a>
  );
}
