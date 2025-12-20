import { useState } from 'react';
import {
  Search,
  Sun,
  Moon,
  Bell,
  User,
  Keyboard,
  Save,
  Cloud,
  CloudOff,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useEditorStore } from '../../stores/editorStore';
import clsx from 'clsx';

export function Header() {
  const { theme, setTheme, sidebarCollapsed } = useAppStore();
  const { isDirty, lastSavedAt, isCollaborating } = useEditorStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);

  const shortcuts = [
    { keys: ['Ctrl', 'S'], action: 'Save prompt' },
    { keys: ['Ctrl', 'Z'], action: 'Undo' },
    { keys: ['Ctrl', 'Shift', 'Z'], action: 'Redo' },
    { keys: ['Ctrl', 'K'], action: 'Quick search' },
    { keys: ['Ctrl', 'E'], action: 'Export prompt' },
    { keys: ['Ctrl', '/'], action: 'Toggle comments' },
    { keys: ['Alt', 'Enter'], action: 'Generate with AI' },
  ];

  return (
    <header
      className={clsx(
        'fixed top-0 right-0 h-16 z-30 flex items-center justify-between px-6 border-b transition-all duration-300',
        theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200',
        sidebarCollapsed ? 'left-16' : 'left-64'
      )}
    >
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className={clsx(
          'flex-1 flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors',
          theme === 'dark'
            ? 'bg-gray-800 border-gray-700 focus-within:border-emerald-500'
            : 'bg-gray-50 border-gray-200 focus-within:border-emerald-500'
        )}>
          <Search className={clsx('w-4 h-4', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
          <input
            type="text"
            placeholder="Search prompts, templates, techniques..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={clsx(
              'flex-1 bg-transparent border-none outline-none text-sm',
              theme === 'dark' ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
            )}
          />
          <kbd className={clsx(
            'hidden sm:inline-flex px-2 py-0.5 text-xs rounded',
            theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
          )}>
            Ctrl+K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm',
          isDirty
            ? theme === 'dark' ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-50 text-amber-600'
            : theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
        )}>
          {isDirty ? (
            <>
              <Save className="w-4 h-4" />
              <span>Unsaved</span>
            </>
          ) : lastSavedAt ? (
            <>
              <Cloud className="w-4 h-4" />
              <span>Saved</span>
            </>
          ) : (
            <>
              <CloudOff className="w-4 h-4" />
              <span>Not saved</span>
            </>
          )}
        </div>

        {isCollaborating && (
          <div className={clsx(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm',
            theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'
          )}>
            <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
            <span>Live</span>
          </div>
        )}

        <div className="w-px h-6 bg-gray-700 mx-2" />

        <button
          onClick={() => setShowShortcuts(!showShortcuts)}
          className={clsx(
            'p-2 rounded-lg transition-colors relative',
            theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
          )}
          title="Keyboard shortcuts"
        >
          <Keyboard className="w-5 h-5" />
        </button>

        {showShortcuts && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowShortcuts(false)}
            />
            <div className={clsx(
              'absolute top-14 right-32 w-72 rounded-lg shadow-xl border z-50 p-4',
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            )}>
              <h3 className={clsx(
                'font-semibold mb-3',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Keyboard Shortcuts
              </h3>
              <ul className="space-y-2">
                {shortcuts.map((shortcut, index) => (
                  <li key={index} className="flex items-center justify-between">
                    <span className={clsx(
                      'text-sm',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      {shortcut.action}
                    </span>
                    <div className="flex gap-1">
                      {shortcut.keys.map((key, i) => (
                        <kbd
                          key={i}
                          className={clsx(
                            'px-2 py-0.5 text-xs rounded',
                            theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                          )}
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={clsx(
            'p-2 rounded-lg transition-colors',
            theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
          )}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <button
          className={clsx(
            'p-2 rounded-lg transition-colors relative',
            theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
          )}
          title="Notifications"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full" />
        </button>

        <button
          className={clsx(
            'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
            theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
          )}
          title="Profile"
        >
          <User className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
