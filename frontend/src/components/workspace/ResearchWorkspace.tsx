import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  FileText,
  FileCode,
  FileSpreadsheet,
  X,
  AlertCircle,
  Sparkles,
  Bot,
  User,
  ArrowRight,
  Download,
  BookOpen,
} from 'lucide-react';
import { AttachedDocument, ResearchMessage, ResearchReport } from '../../types/research';

const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md', 'js', 'jsx', 'json', 'py', 'html', 'css'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

interface ResearchWorkspaceProps {
  messages: ResearchMessage[];
  onSendMessage: (query: string, attachments: AttachedDocument[]) => void;
  isLoading: boolean;
  activeStatusMessage?: string;
  onOpenReportView?: () => void;
  activeReport?: ResearchReport | null;
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['js', 'jsx', 'py', 'html', 'css', 'json'].includes(ext || '')) {
    return <FileCode className="w-3.5 h-3.5 text-indigo-500 shrink-0" />;
  }
  if (['csv', 'tsv', 'xlsx'].includes(ext || '')) {
    return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
  }
  return <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
}

export const ResearchWorkspace: React.FC<ResearchWorkspaceProps> = ({
  messages,
  onSendMessage,
  isLoading,
  activeStatusMessage,
  onOpenReportView,
  activeReport,
}) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<AttachedDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, activeStatusMessage]);

  const handleValidateAndAdd = (files: FileList | File[]) => {
    setError(null);
    const valid: AttachedDocument[] = [];
    const errors: string[] = [];

    Array.from(files).forEach((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
        errors.push(`"${file.name}" has an unsupported format. Allowed: ${ALLOWED_EXTENSIONS.join(', ').toUpperCase()}`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`"${file.name}" exceeds the 25MB size limit.`);
        return;
      }

      valid.push({
        id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: file.name,
        size: file.size,
        type: file.type || ext,
        uploadedAt: new Date().toISOString(),
      });
    });

    if (errors.length > 0) {
      setError(errors[0]);
    }

    if (valid.length > 0) {
      setAttachments((prev) => [...prev, ...valid]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleValidateAndAdd(e.target.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoading) return;
    if (!text.trim() && attachments.length === 0) return;

    onSendMessage(text.trim(), [...attachments]);
    setText('');
    setAttachments([]);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      {/* Messages Stream / Workspace Body */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl w-full mx-auto space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border shadow-sm"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
                color: 'var(--accent)',
              }}
            >
              <Sparkles className="w-6 h-6" />
            </div>

            <h2 className="text-xl font-bold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
              Your Research Workspace
            </h2>
            <p className="text-sm max-w-md mb-8" style={{ color: 'var(--text-secondary)' }}>
              Ask a research question or attach papers and datasets to orchestrate an evolving dynamic team of AI agents.
            </p>

            {/* Quick Sample Queries */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl w-full text-xs text-left">
              {[
                'Synthesize literature on FlashAttention vs Multi-Head Attention mechanisms',
                'Analyze loss convergence when learning rate decay is reduced by 50%',
                'Evaluate multi-agent reasoning handoffs with iterative self-refinement',
                'Investigate trade-offs between dense embeddings and sparse hybrid search',
              ].map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setText(sample)}
                  className="p-3 rounded-xl border transition-all text-left flex items-start justify-between gap-2 hover:opacity-100 opacity-80"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span className="line-clamp-2 leading-relaxed">{sample}</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0 text-indigo-500 mt-0.5" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border mt-0.5"
                    style={{
                      backgroundColor: 'var(--surface-secondary)',
                      borderColor: 'var(--border)',
                      color: 'var(--accent)',
                    }}
                  >
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-2xl ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div
                    className="rounded-2xl p-4 text-sm leading-relaxed border shadow-xs"
                    style={{
                      backgroundColor: isUser ? 'var(--surface-secondary)' : 'var(--surface)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {/* User attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2.5">
                        {msg.attachments.map((a) => (
                          <span
                            key={a.id}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono border"
                            style={{
                              backgroundColor: 'var(--surface)',
                              borderColor: 'var(--border)',
                            }}
                          >
                            {getFileIcon(a.name)}
                            <span className="truncate max-w-[120px]">{a.name}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {/* If assistant generated a report, provide interactive CTA */}
                    {msg.reportId && activeReport && (
                      <div
                        className="mt-3 pt-3 border-t flex items-center justify-between gap-3 text-xs"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <div className="flex items-center gap-1.5 text-emerald-500 font-semibold font-mono text-[11px]">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Report Ready ({activeReport.citations.length} Citations)</span>
                        </div>
                        <button
                          type="button"
                          onClick={onOpenReportView}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                          style={{ backgroundColor: '#10B981' }}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View Full Report & PDF</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] font-mono mt-1 px-1" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {isUser && (
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border mt-0.5"
                    style={{
                      backgroundColor: 'var(--accent)',
                      borderColor: 'var(--accent)',
                      color: '#FFFFFF',
                    }}
                  >
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Dynamic Multi-Agent Live Execution Indicator */}
        {isLoading && (
          <div className="flex items-start gap-3 my-4">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border mt-0.5"
              style={{
                backgroundColor: 'var(--surface-secondary)',
                borderColor: 'var(--border)',
                color: 'var(--accent)',
              }}
            >
              <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: 'var(--accent)' }} />
            </div>
            <div
              className="p-3.5 rounded-xl border text-xs max-w-lg space-y-1.5 shadow-xs"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="flex items-center gap-2 text-indigo-500 font-mono font-bold text-[11px]">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                <span>DYNAMIC AGENT CLUSTER ACTIVE</span>
              </div>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {activeStatusMessage || 'Orchestrating literature reconnaissance and empirical verification...'}
              </p>
              <div className="flex items-center gap-1 text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                <span>User Node</span>
                <span>→</span>
                <span>Orchestrator</span>
                <span>→</span>
                <span>Research Cluster</span>
                <span>→</span>
                <span>Report Delivery</span>
              </div>
            </div>
          </div>
        )}

        <div ref={scrollBottomRef} />
      </div>

      {/* Composer Bottom Area */}
      <div className="shrink-0 p-4 max-w-4xl w-full mx-auto">
        {/* Error notification */}
        {error && (
          <div
            className="mb-2 px-3 py-2 rounded-xl text-xs flex items-center justify-between border text-red-500"
            style={{ backgroundColor: 'var(--surface-secondary)', borderColor: '#EF4444' }}
          >
            <div className="flex items-center gap-2 truncate">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">{error}</span>
            </div>
            <button type="button" onClick={() => setError(null)} className="p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Composer container */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files) handleValidateAndAdd(e.dataTransfer.files);
          }}
          className={`rounded-2xl border transition-all ${
            isDragging ? 'ring-2 ring-indigo-500' : ''
          }`}
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: isDragging ? 'var(--accent)' : 'var(--border)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          }}
        >
          {/* Selected Attachment Chips */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 pb-0">
              {attachments.map((file) => (
                <div
                  key={file.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border"
                  style={{
                    backgroundColor: 'var(--surface-secondary)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {getFileIcon(file.name)}
                  <span className="font-mono text-[11px] truncate max-w-[140px]">{file.name}</span>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(file.id)}
                    className="p-0.5 rounded hover:opacity-100 opacity-60 text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Row */}
          <div className="flex items-end gap-2 p-3">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md,.js,.jsx,.json,.py,.html,.css"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="p-2 rounded-xl transition-colors hover:opacity-100 opacity-70 disabled:opacity-30"
              style={{ color: 'var(--text-secondary)' }}
              title="Attach research papers or code (PDF, DOCX, TXT, MD, PY, JSON)"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a research inquiry or hypothesis to orchestrate the dynamic agent team..."
              rows={1}
              disabled={isLoading}
              className="flex-1 bg-transparent border-0 resize-none py-1.5 px-2 text-sm focus:outline-none placeholder:text-[var(--text-secondary)] leading-relaxed"
              style={{
                color: 'var(--text-primary)',
                minHeight: '32px',
                maxHeight: '160px',
              }}
            />

            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={(!text.trim() && attachments.length === 0) || isLoading}
              className="p-2 rounded-xl transition-all flex items-center justify-center font-bold text-white disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--accent)' }}
              title="Dispatch to dynamic agent cluster (Enter)"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <div
            className="px-3.5 pb-2.5 flex items-center justify-between text-[10px] font-mono"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span>Shift + Enter for newline • Enter to send</span>
            <span>PDF, DOCX, TXT, Code & Data supported</span>
          </div>
        </div>
      </div>
    </div>
  );
};
