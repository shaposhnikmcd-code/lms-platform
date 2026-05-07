import { prisma } from '@/lib/prisma';
import { getYearlyGraceDays } from '@/lib/yearlyProgramConfig';
import CertificatesView from './_components/CertificatesView';

export const dynamic = 'force-dynamic';

export default async function AdminCertificatesPage() {
  const graceDays = await getYearlyGraceDays(prisma);
  return <CertificatesView graceDays={graceDays} />;
}
