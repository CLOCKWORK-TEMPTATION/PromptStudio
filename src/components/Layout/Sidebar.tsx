import {
  PenTool,
  LayoutTemplate,
  BookOpen,
  GitBranch,
  Store,
  History,
  FlaskConical,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import clsx from 'clsx';

const navItems = [
  { id: 'editor', label: 'Editor', icon: PenTool },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'techniques', label: 'Techniques', icon: BookOpen },
  { id: 'chains', label: 'Chains', icon: GitBranch },
  { id: 'testing', label: 'Testing', icon: FlaskConical },
  { id: 'marketplace', label: 'Marketplace', icon: Store },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, activeView, setActiveView, theme } = useAppStore();

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-full z-40 transition-all duration-300 flex flex-col',
        theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200',
        'border-r',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className={clsx(
        'h-16 flex items-center border-b',
        theme === 'dark' ? 'border-gray-800' : 'border-gray-200',
        sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'
      )}>
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <div className={clsx(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              'bg-gradient-to-br from-emerald-500 to-teal-600'
            )}>
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className={clsx(
              'font-semibold text-lg',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              PromptStudio
            </span>
          </div>
        )}
        {sidebarCollapsed && (
          <div className={clsx(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            'bg-gradient-to-br from-emerald-500 to-teal-600'
          )}>
            <Zap className="w-5 h-5 text-white" />
          </div>
        )}
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <li key={item.id}>
                <button
                  onClick={() => setActiveView(item.id as typeof activeView)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                    'focus:outline-none focus:ring-2 focus:ring-emerald-500/50',
                    isActive
                      ? theme === 'dark'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-emerald-50 text-emerald-600'
                      : theme === 'dark'
                        ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
                    sidebarCollapsed && 'justify-center'
                  )}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <Icon className={clsx('w-5 h-5 flex-shrink-0', isActive && 'text-emerald-500')} />
                  {!sidebarCollapsed && (
                    <span className="font-medium">{item.label}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={clsx(
        'p-2 border-t',
        theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
      )}>
        <button
          onClick={toggleSidebar}
          className={clsx(
            'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors',
            theme === 'dark'
              ? 'text-gray-400 hover:text-white hover:bg-gray-800'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          )}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
