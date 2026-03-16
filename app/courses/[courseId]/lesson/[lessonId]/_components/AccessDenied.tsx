import Link from 'next/link';
import { FaLock } from 'react-icons/fa';

interface AccessDeniedProps {
  courseId: string;
}

export default function AccessDenied({ courseId }: AccessDeniedProps) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <FaLock className="text-5xl text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-[#1C3A2E] mb-3">{"Доступ закрито"}</h2>
        <p className="text-gray-500 mb-6">{"Щоб переглянути цей урок, потрібно придбати курс"}</p>
        <Link
          href={`/courses/${courseId}`}
          className="inline-block bg-[#D4A017] text-white font-bold py-3 px-8 rounded-xl hover:bg-[#b88913] transition-colors"
        >
          {"Купити курс"}
        </Link>
      </div>
    </div>
  );
}