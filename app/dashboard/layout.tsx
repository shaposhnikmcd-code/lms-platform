import '@/app/globals.css';
import SessionProviderWrapper from '@/components/SessionProviderWrapper';
import RoleSwitcher from '@/components/RoleSwitcher';
import DashboardBackButton from '@/components/DashboardBackButton';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProviderWrapper>
      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-slate-900/80 border-b border-slate-800">
          <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
            <span className="text-white font-semibold text-xl tracking-wide">UIMP <span className="text-slate-400 font-normal">Dashboard</span></span>
            <RoleSwitcher />
          </div>
        </header>
        <DashboardBackButton />
        {children}
      </div>
    </SessionProviderWrapper>
  );
}