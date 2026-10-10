import React from 'react';
import {
  Plus,
  MessageSquare,
  Network,
  FileText,
  LayoutDashboard,
  Terminal,
  PanelLeftClose,
  PanelLeft,
  Trash2,
  Cpu,
  X,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { ThemeToggle } from '../common/ThemeToggle';
import { ResearchSession } from '../../types/research';

export type AppViewTab = 'workspace' | 'graph' | 'report' | 'overview' | 'terminal';

interface SidebarProps {
  activeTab: AppViewTab;
  onTabChange: (tab: AppViewTab) => void;
  sessions: ResearchSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  hasReport: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  theme,
  onToggleTheme,
  hasReport,
}) => {
  const navItems = [
    {
      id: 'workspace' as AppViewTab,
      label: 'Research Workspace',
      icon: <MessageSquare className="w-4 h-4" />,
    },
    {
      id: 'graph' as AppViewTab,
      label: 'Dynamic Agent Graph',
      icon: <Network className="w-4 h-4" />,
      badge: 'User Loop',
    },
    {
      id: 'report' as AppViewTab,
      label: 'Research Report',
      icon: <FileText className="w-4 h-4" />,
      badge: hasReport ? 'PDF Ready' : undefined,
      badgeColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    },
    {
      id: 'overview' as AppViewTab,
      label: 'Cockpit & Metrics',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'terminal' as AppViewTab,
      label: 'Terminal & Logs',
      icon: <Terminal className="w-4 h-4" />,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 flex flex-col transition-all duration-200 border-r select-none ${
          isMobileOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'
        } ${isCollapsed ? 'md:w-16' : 'md:w-64'}`}
        style={{
          backgroundColor: 'var(--bg-sidebar)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Header / Brand */}
        <div
          className={`h-14 flex items-center justify-between border-b px-3.5 ${
            isCollapsed ? 'md:justify-center' : ''
          }`}
          style={{ borderColor: 'var(--border)' }}
        >
          {(!isCollapsed || isMobileOpen) ? (
            <div className="flex items-center gap-2.5 truncate">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-bold text-white shadow-xs"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <Cpu className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold tracking-tight truncate" style={{ color: 'var(--text-primary)' }}>
                  PS3 Workspace
                </span>
                <span className="text-[10px] font-mono tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  Evolving AI Env
                </span>
              </div>
            </div>
          ) : (
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white"
              style={{ backgroundColor: 'var(--accent)' }}
              title="PS3 Research Workspace"
            >
              <Cpu className="w-4 h-4" />
            </div>
          )}

          {/* Collapse Toggle */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden md:flex p-1.5 rounded-md hover:opacity-100 opacity-60 transition-opacity"
            style={{ color: 'var(--text-secondary)' }}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>

          {isMobileOpen && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-md"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Action: + New Research */}
        <div className="p-3">
          <button
            type="button"
            onClick={() => {
              onNewSession();
              if (isMobileOpen) onCloseMobile();
            }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all border shadow-xs ${
              isCollapsed ? 'justify-center px-0' : ''
            }`}
            style={{
              backgroundColor: 'var(--surface-secondary)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-secondary)')}
            title="Start new research session"
          >
            <Plus className="w-4 h-4 text-indigo-500 shrink-0" />
            {(!isCollapsed || isMobileOpen) && <span>New Research</span>}
          </button>
        </div>

        {/* Primary Navigation Views */}
        <div className="px-2 space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onTabChange(item.id);
                  if (isMobileOpen) onCloseMobile();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  isCollapsed ? 'justify-center px-0' : ''
                }`}
                style={{
                  backgroundColor: isActive ? 'var(--hover)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 400,
                }}
                title={item.label}
              >
                <span style={{ color: isActive ? 'var(--accent)' : 'inherit' }}>
                  {item.icon}
                </span>
                {(!isCollapsed || isMobileOpen) && (
                  <div className="flex items-center justify-between flex-1 truncate">
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ml-1 ${
                          item.badgeColor || 'border-[var(--border)] text-indigo-500'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Recent Research Sessions */}
        <div className="flex-1 overflow-y-auto px-2 mt-4 space-y-1 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
          {(!isCollapsed || isMobileOpen) && (
            <div
              className="px-2 pb-1 text-[10px] font-mono tracking-wider uppercase font-semibold select-none"
              style={{ color: 'var(--text-secondary)' }}
            >
              Recent Sessions
            </div>
          )}

          {sessions.map((sess) => {
            const isSelected = sess.id === activeSessionId;
            return (
              <div key={sess.id} className="group relative flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    onSelectSession(sess.id);
                    if (isMobileOpen) onCloseMobile();
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-left transition-colors truncate ${
                    isCollapsed ? 'justify-center px-0' : ''
                  }`}
                  style={{
                    backgroundColor: isSelected ? 'var(--hover)' : 'transparent',
                    color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                  title={sess.title}
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: isSelected ? 'var(--accent)' : 'inherit' }} />
                  {(!isCollapsed || isMobileOpen) && (
                    <span className="truncate pr-6">{sess.title}</span>
                  )}
                </button>

                {(!isCollapsed || isMobileOpen) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(sess.id);
                    }}
                    className="absolute right-1.5 p-1 rounded opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
                    style={{ color: 'var(--text-secondary)' }}
                    title="Delete session"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer: Theme Toggle */}
        <div className="p-3 border-t mt-auto" style={{ borderColor: 'var(--border)' }}>
          <ThemeToggle
            theme={theme}
            toggleTheme={onToggleTheme}
            collapsed={isCollapsed && !isMobileOpen}
          />
        </div>
      </aside>
    </>
  );
};
