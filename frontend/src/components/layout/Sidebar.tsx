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
  X,
  Clock,
  Sun,
  Moon,
} from 'lucide-react';
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

const NAV_ITEMS = [
  { id: 'workspace' as AppViewTab, label: 'Workspace',     icon: MessageSquare },
  { id: 'graph'     as AppViewTab, label: 'Agent Graph',   icon: Network       },
  { id: 'report'    as AppViewTab, label: 'Report',        icon: FileText      },
  { id: 'overview'  as AppViewTab, label: 'Cockpit',       icon: LayoutDashboard },
  { id: 'terminal'  as AppViewTab, label: 'Terminal',      icon: Terminal      },
];

function timeAgo(isoString: string) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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
  const expanded = isMobileOpen || !isCollapsed;

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50 flex flex-col
          transition-[width] duration-200 ease-in-out border-r select-none
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${expanded ? 'w-56' : 'w-14'}
        `}
        style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border)' }}
      >
        {/* ── Brand row ── */}
        <div
          className="h-12 flex items-center justify-between shrink-0 border-b"
          style={{ borderColor: 'var(--border)', padding: expanded ? '0 12px' : '0 0' }}
        >
          {expanded ? (
            <div className="flex items-center gap-2.5">
              {/* Logo mark */}
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-white text-[11px] font-bold tracking-tight"
                style={{ background: 'var(--accent)' }}
              >
                A
              </div>
              <span className="text-[13px] font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                ARES
              </span>
            </div>
          ) : (
            <div className="w-14 flex items-center justify-center">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[11px] font-bold"
                style={{ background: 'var(--accent)' }}
              >
                A
              </div>
            </div>
          )}

          <div className="flex items-center gap-1">
            {isMobileOpen && (
              <button onClick={onCloseMobile} className="md:hidden p-1.5 rounded-md" style={{ color: 'var(--text-secondary)' }}>
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onToggleCollapse}
              className="hidden md:flex p-1.5 rounded-md transition-colors"
              style={{ color: 'var(--text-muted)' }}
              title={isCollapsed ? 'Expand' : 'Collapse'}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              {isCollapsed ? <PanelLeft className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* ── New session button ── */}
        <div className="px-2 pt-2.5 pb-1 shrink-0">
          <button
            onClick={() => { onNewSession(); if (isMobileOpen) onCloseMobile(); }}
            className={`
              w-full flex items-center gap-2 rounded-md text-[12px] font-medium
              border transition-colors
              ${expanded ? 'px-3 py-1.5' : 'justify-center p-1.5'}
            `}
            style={{
              backgroundColor: 'var(--surface-secondary)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--surface-secondary)')}
            title="New research session"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
            {expanded && <span>New Session</span>}
          </button>
        </div>

        {/* ── Primary navigation ── */}
        <nav className="px-2 space-y-0.5 shrink-0">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            const showReportDot = id === 'report' && hasReport;
            return (
              <button
                key={id}
                onClick={() => { onTabChange(id); if (isMobileOpen) onCloseMobile(); }}
                className={`
                  w-full flex items-center gap-2.5 rounded-md text-[12px] transition-colors relative
                  ${expanded ? 'px-2.5 py-1.5' : 'justify-center p-2'}
                `}
                style={{
                  backgroundColor: active ? 'var(--accent-subtle)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: active ? 500 : 400,
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = 'var(--hover)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
                title={label}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {expanded && <span>{label}</span>}
                {showReportDot && (
                  <span
                    className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: 'var(--success)' }}
                    title="Report ready"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* ── Divider ── */}
        <div className="mx-2 my-2 border-t" style={{ borderColor: 'var(--border)' }} />

        {/* ── Session history ── */}
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5 min-h-0">
          {expanded && (
            <p className="px-2 pt-0.5 pb-1.5 text-[10px] uppercase tracking-widest font-medium" style={{ color: 'var(--text-muted)' }}>
              History
            </p>
          )}
          {sessions.map((sess) => {
            const active = sess.id === activeSessionId;
            return (
              <div key={sess.id} className="group relative flex items-center">
                <button
                  onClick={() => { onSelectSession(sess.id); if (isMobileOpen) onCloseMobile(); }}
                  className={`
                    w-full flex items-center gap-2 rounded-md text-[11.5px] text-left transition-colors
                    ${expanded ? 'px-2 py-1.5' : 'justify-center p-1.5'}
                  `}
                  style={{
                    backgroundColor: active ? 'var(--hover)' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: active ? 500 : 400,
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = 'var(--hover)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  title={sess.title}
                >
                  {expanded ? (
                    <div className="flex-1 min-w-0 pr-5">
                      <div className="truncate leading-tight">{sess.title}</div>
                      <div className="flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        <Clock className="w-2.5 h-2.5 shrink-0" />
                        <span className="text-[10px]">{timeAgo(sess.createdAt)}</span>
                      </div>
                    </div>
                  ) : (
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                  )}
                </button>
                {expanded && (
                  <button
                    onClick={e => { e.stopPropagation(); onDeleteSession(sess.id); }}
                    className="absolute right-1 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--error)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Footer: theme toggle ── */}
        <div className="px-2 py-2.5 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={onToggleTheme}
            className={`
              w-full flex items-center gap-2 rounded-md text-[12px] transition-colors
              ${expanded ? 'px-2.5 py-1.5' : 'justify-center p-2'}
            `}
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark'
              ? <Sun className="w-3.5 h-3.5 shrink-0" />
              : <Moon className="w-3.5 h-3.5 shrink-0" />
            }
            {expanded && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
