import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions, getAllowedRoles } from '@/lib/auth';

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/');
  }
  const allowed = getAllowedRoles(session.user.role);
  if (!allowed.includes('TEACHER')) {
    redirect('/dashboard');
  }
  return <>{children}</>;
}
