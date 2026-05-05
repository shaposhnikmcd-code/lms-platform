import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';

/// Pre-paint тема: читаємо localStorage синхронно і ставимо `data-admin-theme`
/// на <html> ДО першого React render-у. Без цього на refresh видно flash
/// світлої теми, бо useState стартує з 'light', а useEffect (з localStorage='dark')
/// перерендерює лише після hydration.
const themeInitScript = `(function(){try{var s=localStorage.getItem('admin-theme-v1');var t=(s==='dark'||s==='light')?s:'light';document.documentElement.dataset.adminTheme=t;}catch(e){document.documentElement.dataset.adminTheme='light';}})();`;

/// CSS scoped до `.admin-root`-обгортки: задає bg ДО того, як React встигне
/// відрендерити AdminShell. Тримає тему під час mounted-gate в AdminShell.
/// `color-scheme` ставимо на html ТІЛЬКИ коли рендериться `.admin-root` (через
/// `:has()`). Інакше native dropdown у select-ах усередині модалок (через
/// createPortal у document.body, тобто поза .admin-root) не успадковує темну
/// схему і Chromium малює popup білим. `:has()` гарантує, що при client-side
/// навігації з адмінки на клієнтські сторінки правило знімається разом із
/// розмонтуванням `.admin-root`.
const themeBgCss = `html[data-admin-theme="dark"]:has(.admin-root){color-scheme:dark}html[data-admin-theme="light"]:has(.admin-root){color-scheme:light}html[data-admin-theme="dark"] .admin-root{background-color:#0b0d12}html[data-admin-theme="light"] .admin-root{background-color:#f4eee1}`;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/');
  }
  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      <style dangerouslySetInnerHTML={{ __html: themeBgCss }} />
      <div className="admin-root">{children}</div>
    </>
  );
}
