import React from 'react';
import { ExperimentMetadata } from '../../types/metric';
import { ConnectionConfig } from '../../types/events';
import {
  Menu,
} from 'lucide-react';

interface HeaderProps {
  sessionTitle: string;
  experiment: ExperimentMetadata;
  config?: ConnectionConfig;
  isConnected?: boolean;
  hasReport?: boolean;
  onOpenReport?: () => void;
  onOpenEmergencyModal?: () => void;
  onTogglePauseResume?: () => void;
  onOpenConnectionModal?: () => void;
  onOpenMobileSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  sessionTitle,
  experiment,
  onOpenMobileSidebar,
}) => {
  const isRunning = experiment.status === 'running';
  const isHalted  = experiment.status === 'halted';

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
    </header>
  );
};
