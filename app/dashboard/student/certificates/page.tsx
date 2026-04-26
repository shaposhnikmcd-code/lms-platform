import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import Link from 'next/link';
import { FaCertificate, FaDownload } from 'react-icons/fa';

export default async function CertificatesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/');
  }

  const userId = (session.user as any).id;

  const certificates = userId === 'test-student-1' ? [] : await prisma.certificate.findMany({
    where: { userId, revoked: false },
    include: { course: true },
    orderBy: { issuedAt: 'desc' },
  });

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/dashboard/student" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1C3A2E] mb-4 transition-colors">
        ← Назад до кабінету
      </Link>
      <h1 className="text-2xl font-bold text-[#1C3A2E] mb-6">Сертифікати</h1>

      {certificates.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm">
          <FaCertificate className="text-5xl text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-2">У вас ще немає сертифікатів</p>
          <p className="text-gray-400 text-sm mb-6">
            Завершіть курс на 100% щоб отримати сертифікат
          </p>
          <Link
            href="/courses"
            className="inline-block bg-[#D4A017] text-white font-bold py-3 px-8 rounded-xl hover:bg-[#b88913] transition-colors"
          >
            Переглянути курси
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {certificates.map((cert) => (
            <div key={cert.id} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-[#D4A017]/10 rounded-full flex items-center justify-center">
                  <FaCertificate className="text-[#D4A017] text-xl" />
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(cert.issuedAt).toLocaleDateString('uk-UA')}
                </span>
              </div>
              <h3 className="font-bold text-lg text-[#1C3A2E] mb-1">
                {cert.courseName ?? cert.course?.title ?? (cert.type === 'YEARLY_PROGRAM' ? 'Річна програма' : 'Курс UIMP')}
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                {cert.type === 'YEARLY_PROGRAM'
                  ? cert.category === 'LISTENER' ? 'Слухач Річної програми' : 'Практична участь у Річній програмі'
                  : 'Курс успішно завершено'}
              </p>
              <a
                href={`/api/certificate/${cert.verificationToken}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-[#1C3A2E] text-white font-medium py-2 px-4 rounded-lg hover:bg-[#2a5242] transition-colors text-sm"
              >
                <FaDownload />
                Завантажити PDF
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}