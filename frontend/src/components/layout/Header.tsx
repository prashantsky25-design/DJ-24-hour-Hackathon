import React from 'react';
import { ExperimentMetadata } from '../../types/metric';
import { ConnectionConfig } from '../../types/events';
import {
  Menu,
  Pause,
  Play,
  Square,
  Settings2,
  FileText,
  Wifi,
  WifiOff,
  Activity,
} from 'lucide-react';

interface HeaderProps {
  sessionTitle: string;
  experiment: ExperimentMetadata;
  config: ConnectionConfig;
  isConnected: boolean;
  hasReport: boolean;
  onOpenReport: () => void;
  onOpenEmergencyModal: () => void;
  onTogglePauseResume: () => void;
  onOpenConnectionModal: () => void;
  onOpenMobileSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  sessionTitle,
  experiment,
  config,
  isConnected,
  hasReport,
  onOpenReport,
  onOpenEmergencyModal,
  onTogglePauseResume,
  onOpenConnectionModal,
  onOpenMobileSidebar,
}) => {
  const isRunning = experiment.status === 'running';
  const isHalted  = experiment.status === 'halted';

  const connLabel =
    config.mode === 'simulator' ? 'Simulator' :
    config.mode === 'websocket' ? 'WebSocket' : 'SSE';

  const connColor =
    config.mode === 'simulator' ? '#60A5FA' :
    isConnected ? 'var(--success)' : 'var(--warning)';

  return (
    <header
      className="sticky top-0 z-40 w-full border-b flex items-center justify-between px-4 h-12 shrink-0"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      {/* ── Left ── */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile hamburger */}
        <button
          onClick={onOpenMobileSidebar}
          className="md:hidden p-1 rounded"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Open menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Session name */}
        <span
          className="text-[13px] font-semibold truncate max-w-xs"
          style={{ color: 'var(--text-primary)' }}
          title={sessionTitle}
        >
          {sessionTitle}
        </span>

        {/* Status pill */}
        <div className="hidden sm:flex items-center gap-1.5">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${isRunning ? 'animate-pulse' : ''}`}
            style={{
              backgroundColor: isHalted  ? 'var(--error)' :
                               isRunning ? 'var(--success)' : 'var(--text-muted)'
            }}
          />
          <span
            className="text-[11px] capitalize"
            style={{ color: 'var(--text-secondary)' }}
          >
            {experiment.status}
          </span>
        </div>
      </div>

      {/* ── Right controls ── */}
      <div className="flex items-center gap-2 shrink-0">

        {/* Connection badge */}
        <button
          onClick={onOpenConnectionModal}
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] transition-colors"
          style={{
            backgroundColor: 'var(--surface-secondary)',
            borderColor: 'var(--border)',
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--surface-secondary)')}
          title="Connection settings"
        >
          {config.mode !== 'simulator' && isConnected
            ? <Wifi  className="w-3 h-3" style={{ color: connColor }} />
            : <WifiOff className="w-3 h-3" style={{ color: connColor }} />
          }
          <span style={{ color: connColor }}>{connLabel}</span>
          <Settings2 className="w-3 h-3 ml-0.5" style={{ color: 'var(--text-muted)' }} />
        </button>

        {/* Report button */}
        {hasReport && (
          <button
            onClick={onOpenReport}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-white"
            style={{ backgroundColor: 'var(--success)' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <FileText className="w-3 h-3" />
            <span className="hidden sm:inline">Report</span>
          </button>
        )}

        {/* Pause / Resume */}
        {!isHalted && (
          <button
            onClick={onTogglePauseResume}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors"
            style={{
              backgroundColor: 'transparent',
              borderColor: isRunning ? 'var(--warning)' : 'var(--success)',
              color: isRunning ? 'var(--warning)' : 'var(--success)',
            }}
            title={isRunning ? 'Pause execution' : 'Resume execution'}
          >
            {isRunning
              ? <><Pause className="w-3 h-3" /><span className="hidden sm:inline">Pause</span></>
              : <><Play  className="w-3 h-3" /><span className="hidden sm:inline">Resume</span></>
            }
          </button>
        )}

        {/* Emergency stop — only icon, no label */}
        <button
          onClick={onOpenEmergencyModal}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-white"
          style={{ backgroundColor: 'var(--error)' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          title="Emergency stop"
        >
          <Square className="w-3 h-3 fill-current" />
          <span className="hidden sm:inline">Stop</span>
        </button>
      </div>
    </header>
  );
};
