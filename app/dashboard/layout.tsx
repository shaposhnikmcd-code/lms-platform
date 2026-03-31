import '@/app/globals.css';
import SessionProviderWrapper from '@/components/SessionProviderWrapper';
import RoleSwitcher from '@/components/RoleSwitcher';
import Link from 'next/link';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProviderWrapper>
      <div className="min-h-screen bg-gray-50">
        <div className="bg-[#1C3A2E] px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-[#D4A843] font-bold text-sm tracking-widest">{"UIMP Dashboard"}</span>
            <Link href="/" className="text-white/60 hover:text-white text-xs transition-colors">
              {"← На головну"}
            </Link>
          </div>
          <RoleSwitcher />
        </div>
        {children}
      </div>
    </SessionProviderWrapper>
  );
}