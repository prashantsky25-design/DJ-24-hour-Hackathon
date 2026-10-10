import React from 'react';
import { ExperimentMetadata } from '../../types/metric';
import { ConnectionConfig } from '../../types/events';
import {
  Menu,
  Pause,
  Play,
  OctagonAlert,
  Settings2,
  FileText,
  Download,
  Sparkles,
  CircleDot,
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
  const isPaused = experiment.status === 'paused';
  const isHalted = experiment.status === 'halted';

  return (
    <header
      className="sticky top-0 z-40 w-full border-b backdrop-blur-md px-4 sm:px-6 py-2.5 transition-colors select-none"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
        {/* Left: Mobile Nav & Session Title */}
        <div className="flex items-center gap-3 truncate">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="md:hidden p-1.5 rounded-lg hover:opacity-100 opacity-70"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="truncate">
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-xs sm:text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                {sessionTitle}
              </span>
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded-full border hidden sm:inline-block font-semibold"
                style={{
                  backgroundColor: 'var(--surface-secondary)',
                  borderColor: 'var(--border)',
                  color: 'var(--accent)',
                }}
              >
                PS3 AI Research Env
              </span>
            </div>
            <div className="text-[10px] font-mono flex items-center gap-2 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              <span>Autonomous Multi-Agent Loop</span>
              <span>•</span>
              <span>Closed-Loop User Connected</span>
            </div>
          </div>
        </div>

        {/* Center / Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Quick PDF Report Button if report is generated */}
          {hasReport && (
            <button
              type="button"
              onClick={onOpenReport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white shadow-sm transition-all hover:scale-102 active:scale-98"
              style={{ backgroundColor: '#10B981' }}
              title="Open Research Report & Download PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Report & PDF</span>
            </button>
          )}

          {/* Connection Mode Pill */}
          <button
            type="button"
            onClick={onOpenConnectionModal}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs transition-colors hover:opacity-100 opacity-80"
            style={{
              backgroundColor: 'var(--surface-secondary)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
            title="Configure connection settings"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                config.mode === 'simulator'
                  ? 'bg-sky-400'
                  : isConnected
                  ? 'bg-emerald-400'
                  : 'bg-amber-400'
              }`}
            />
            <span className="font-mono uppercase text-[10px]">
              {config.mode === 'simulator' ? 'Simulator' : config.mode.toUpperCase()}
            </span>
            <Settings2 className="w-3 h-3 ml-0.5" style={{ color: 'var(--text-secondary)' }} />
          </button>

          {/* Pause / Resume Button */}
          {!isHalted && (
            <button
              type="button"
              onClick={onTogglePauseResume}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all hover:opacity-100 opacity-90"
              style={{
                backgroundColor: isRunning ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                borderColor: isRunning ? '#F59E0B' : '#10B981',
                color: isRunning ? '#F59E0B' : '#10B981',
              }}
            >
              {isRunning ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Resume</span>
                </>
              )}
            </button>
          )}

          {/* Emergency Stop Button */}
          <button
            type="button"
            onClick={onOpenEmergencyModal}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-xs"
            title="Emergency halt of execution cluster"
          >
            <OctagonAlert className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">HALT</span>
          </button>
        </div>
      </div>
    </header>
  );
};
