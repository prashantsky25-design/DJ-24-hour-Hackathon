import React, { useEffect, useRef } from 'react';
import {
  MessageSquare,
  User,
  Bot,
  FileText,
  Paperclip,
  Loader2,
  Zap,
} from 'lucide-react';
import type { ResearchSession, ResearchMessage } from '../../types/research';

interface LiveChatFeedProps {
  session: ResearchSession;
  isProcessing: boolean;
  pipelineStepMessage: string;
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return ''; }
}

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return 'Just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return new Date(iso).toLocaleDateString();
  } catch { return ''; }
}

const UserBubble: React.FC<{ message: ResearchMessage }> = ({ message }) => (
  <div className="flex items-end gap-2 justify-end group">
    <div className="flex flex-col items-end gap-1 max-w-[85%]">
      <div
        className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: 'var(--text-muted)' }}
      >
        {formatTimestamp(message.timestamp)}
      </div>

      {message.attachments && message.attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 justify-end">
          {message.attachments.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px]"
              style={{
                backgroundColor: 'var(--accent-subtle)',
                border: '1px solid var(--border)',
                color: 'var(--accent)',
              }}
            >
              <Paperclip className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[140px]">{doc.name}</span>
            </div>
          ))}
        </div>
      )}

      <div
        className="px-3.5 py-2.5 rounded-2xl rounded-br-sm text-xs leading-relaxed text-white"
        style={{ background: 'var(--accent)' }}
      >
        {message.content}
      </div>
      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
        {relativeTime(message.timestamp)}
      </span>
    </div>
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mb-5"
      style={{ backgroundColor: 'var(--accent)' }}
    >
      <User className="w-3.5 h-3.5 text-white" />
    </div>
  </div>
);

const AssistantBubble: React.FC<{ message: ResearchMessage }> = ({ message }) => (
  <div className="flex items-end gap-2 group">
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mb-5 border"
      style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)' }}
    >
      <Bot className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
    </div>
    <div className="flex flex-col gap-1 max-w-[85%]">
      <div
        className="flex items-center gap-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: 'var(--text-muted)' }}
      >
        <span className="font-semibold" style={{ color: 'var(--accent)' }}>ARES</span>
        <span>{formatTimestamp(message.timestamp)}</span>
      </div>
      <div
        className="px-3.5 py-2.5 rounded-2xl rounded-bl-sm text-xs leading-relaxed"
        style={{
          backgroundColor: 'var(--surface-secondary)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
        }}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.reportId && (
          <div
            className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium"
            style={{ color: 'var(--success)' }}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Research report generated — view in Report tab</span>
          </div>
        )}
      </div>
      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
        {relativeTime(message.timestamp)}
      </span>
    </div>
  </div>
);

const AgentStatusBubble: React.FC<{ message: ResearchMessage }> = ({ message }) => (
  <div className="flex items-center justify-center">
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px]"
      style={{
        backgroundColor: 'var(--surface-secondary)',
        border: '1px solid var(--border)',
        color: 'var(--text-muted)',
      }}
    >
      <Zap className="w-3 h-3 text-amber-500" />
      <span>{message.content}</span>
      <span>{relativeTime(message.timestamp)}</span>
    </div>
  </div>
);

const TypingIndicator: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-end gap-2">
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border"
      style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--accent)' }}
    >
      <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--accent)' }} />
    </div>
    <div
      className="px-3.5 py-2.5 rounded-2xl rounded-bl-sm text-xs"
      style={{
        backgroundColor: 'var(--surface-secondary)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono" style={{ color: 'var(--accent)' }}>
          {message || 'Processing…'}
        </span>
        <span className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1 h-1 rounded-full"
              style={{
                backgroundColor: 'var(--accent)',
                animation: `cockpit-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </span>
      </div>
    </div>
  </div>
);

export const LiveChatFeed: React.FC<LiveChatFeedProps> = ({
  session,
  isProcessing,
  pipelineStepMessage,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.messages, isProcessing]);

  const messages = session.messages;

  return (
    <div
      className="flex flex-col rounded-xl border overflow-hidden h-full"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b shrink-0"
        style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
            Live Chat Feed
          </span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full border"
            style={{
              backgroundColor: 'var(--accent-subtle)',
              borderColor: 'var(--border)',
              color: 'var(--accent)',
            }}
          >
            {messages.length} message{messages.length !== 1 ? 's' : ''}
          </span>
        </div>
        {isProcessing && (
          <div className="flex items-center gap-1.5 text-[10px] text-amber-500">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>Live</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <MessageSquare className="w-8 h-8 mb-3" style={{ color: 'var(--border-strong)' }} />
            <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
              No messages yet. Send a query from the Workspace tab.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.role === 'user') return <UserBubble key={msg.id} message={msg} />;
            if (msg.role === 'assistant') return <AssistantBubble key={msg.id} message={msg} />;
            return <AgentStatusBubble key={msg.id} message={msg} />;
          })
        )}
        {isProcessing && <TypingIndicator message={pipelineStepMessage} />}
        <div ref={bottomRef} />
      </div>

      <style>{`
        @keyframes cockpit-bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
};
