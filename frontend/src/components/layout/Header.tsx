import React from 'react';
import { ExperimentMetadata } from '../../types/metric';
import { ConnectionConfig } from '../../types/events';
import {
  Menu,
  Info,
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
  onOpenImplementationDetails?: () => void;
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
  onOpenImplementationDetails,
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

      {/* ── Right controls ── */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Implementation Details Button */}
        {onOpenImplementationDetails && (
          <button
            onClick={onOpenImplementationDetails}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] transition-colors font-medium"
            style={{
              backgroundColor: 'var(--surface-secondary)',
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'var(--hover)';
              e.currentTarget.style.borderColor = '#06b6d4';
              e.currentTarget.style.color = '#06b6d4';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'var(--surface-secondary)';
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            title="View Production Implementation Details"
          >
            <Info className="w-3 h-3" />
            <span>Implementation</span>
          </button>
        )}
      </div>
    </header>
  );
};
