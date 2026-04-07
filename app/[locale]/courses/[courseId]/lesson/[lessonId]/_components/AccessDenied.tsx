import Link from 'next/link';
import { FaLock } from 'react-icons/fa';
import { getTranslations } from 'next-intl/server';

interface AccessDeniedProps {
  courseId: string;
}

export default async function AccessDenied({ courseId }: AccessDeniedProps) {
  const t = await getTranslations("DynamicCourse");
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <FaLock className="text-5xl text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-[#1C3A2E] mb-3">{t("accessDeniedTitle")}</h2>
        <p className="text-gray-500 mb-6">{t("accessDeniedDesc")}</p>
        <Link
          href={`/courses/${courseId}`}
          className="inline-block bg-[#D4A017] text-white font-bold py-3 px-8 rounded-xl hover:bg-[#b88913] transition-colors"
        >
          {t("btnBuy")}
        </Link>
      </div>
    </div>
  );
}
