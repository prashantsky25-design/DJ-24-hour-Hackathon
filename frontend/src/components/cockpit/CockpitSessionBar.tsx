import React from 'react';
import {
  FlaskConical,
  BookOpen,
  MessageSquare,
  FileSearch,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  ChevronRight,
} from 'lucide-react';
import type { ResearchSession } from '../../types/research';
import type { QueryIntent } from '../../services/intentRouter';

interface CockpitSessionBarProps {
  session: ResearchSession;
  isProcessing: boolean;
  pipelineStepMessage: string;
  intent?: QueryIntent | null;
}

const INTENT_META: Record<
  QueryIntent,
  { label: string; icon: React.ReactNode; color: string }
> = {
  experiment: {
    label: 'Experiment Pipeline',
    icon: <FlaskConical className="w-3.5 h-3.5" />,
    color: 'text-violet-500',
  },
  paper: {
    label: 'Paper Analysis',
    icon: <FileSearch className="w-3.5 h-3.5" />,
    color: 'text-blue-500',
  },
  literature: {
    label: 'Literature Review',
    icon: <BookOpen className="w-3.5 h-3.5" />,
    color: 'text-teal-500',
  },
  chat: {
    label: 'Direct Response',
    icon: <MessageSquare className="w-3.5 h-3.5" />,
    color: '',
  },
};

const SESSION_STATUS_META: Record<
  ResearchSession['status'],
  { icon: React.ReactNode; colorClass: string; label: string }
> = {
  idle:         { icon: <Clock className="w-3.5 h-3.5" />,                        colorClass: '',                   label: 'Idle' },
  orchestrating:{ icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,         colorClass: 'text-amber-500',     label: 'Orchestrating' },
  researching:  { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,         colorClass: 'text-blue-500',      label: 'Researching' },
  synthesizing: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,         colorClass: 'text-violet-500',    label: 'Synthesizing' },
  completed:    { icon: <CheckCircle2 className="w-3.5 h-3.5" />,                 colorClass: 'text-emerald-500',   label: 'Completed' },
  halted:       { icon: <AlertCircle className="w-3.5 h-3.5" />,                  colorClass: 'text-red-500',       label: 'Halted' },
  error:        { icon: <AlertCircle className="w-3.5 h-3.5" />,                  colorClass: 'text-red-500',       label: 'Error' },
};

export const CockpitSessionBar: React.FC<CockpitSessionBarProps> = ({
  session,
  isProcessing,
  pipelineStepMessage,
  intent,
}) => {
  const statusMeta = SESSION_STATUS_META[session.status] ?? SESSION_STATUS_META.idle;
  const intentMeta = intent ? INTENT_META[intent] : null;
  const lastUserMessage = [...session.messages].reverse().find((m) => m.role === 'user');
  const msgCount = session.messages.length;
  const docCount = session.documents.length;

  return (
    <div
      className="rounded-xl border px-4 py-2.5 flex flex-col sm:flex-row sm:items-center gap-3 shrink-0"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: isProcessing ? 'var(--accent)' : 'var(--border)',
        boxShadow: isProcessing ? '0 0 0 1px var(--accent-subtle)' : undefined,
        transition: 'border-color 0.3s ease',
      }}
    >
      {/* Status */}
      <div className="flex items-center gap-2 shrink-0">
        <span className={`flex items-center gap-1.5 text-xs font-semibold ${statusMeta.colorClass}`}
          style={!statusMeta.colorClass ? { color: 'var(--text-secondary)' } : undefined}>
          {statusMeta.icon}
          <span>{statusMeta.label}</span>
        </span>

        {intentMeta && (
          <>
            <ChevronRight className="w-3 h-3" style={{ color: 'var(--border-strong)' }} />
            <span
              className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${intentMeta.color}`}
              style={{ backgroundColor: 'var(--accent-subtle)', borderColor: 'var(--border)' }}
            >
              {intentMeta.icon}
              {intentMeta.label}
            </span>
          </>
        )}
      </div>

      {/* Divider */}
      <div className="hidden sm:block w-px h-6 shrink-0" style={{ backgroundColor: 'var(--border)' }} />

      {/* Active message */}
      <div className="flex-1 min-w-0">
        {isProcessing && pipelineStepMessage ? (
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0 animate-pulse" />
            <span className="text-xs truncate font-mono text-amber-500">
              {pipelineStepMessage}
            </span>
          </div>
        ) : lastUserMessage ? (
          <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--text-muted)' }} className="mr-1.5">Last query:</span>
            {lastUserMessage.content}
          </p>
        ) : (
          <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
            No query yet — send a message from the Workspace tab.
          </p>
        )}
      </div>

      {/* Metadata chips */}
      <div className="flex items-center gap-2 shrink-0 text-[10px]">
        <span
          className="px-2 py-0.5 rounded-full border"
          style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          {msgCount} msg{msgCount !== 1 ? 's' : ''}
        </span>
        {docCount > 0 && (
          <span
            className="px-2 py-0.5 rounded-full border"
            style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            {docCount} doc{docCount !== 1 ? 's' : ''}
          </span>
        )}
        <span className="hidden sm:block font-mono truncate max-w-[120px]" style={{ color: 'var(--text-muted)' }}>
          {session.title}
        </span>
      </div>
    </div>
  );
};
