import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAppStore } from '../../stores/appStore';
import clsx from 'clsx';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { sidebarCollapsed, theme } = useAppStore();

  return (
    <div className={clsx(
      'min-h-screen transition-colors duration-200',
      theme === 'dark' ? 'bg-gray-950' : 'bg-gray-50'
    )}>
      <Sidebar />
      <Header />
      <main
        className={clsx(
          'pt-16 min-h-screen transition-all duration-300',
          sidebarCollapsed ? 'pl-16' : 'pl-64'
        )}
      >
        <div className="h-[calc(100vh-4rem)] overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
