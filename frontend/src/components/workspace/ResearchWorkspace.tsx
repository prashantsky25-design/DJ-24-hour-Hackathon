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
  /** Opens the pipeline execution modal */
  onOpenPipeline?: () => void;
  isProcessing?: boolean;
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
  onOpenPipeline,
  isProcessing,
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
      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-2 py-5 space-y-4">

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-14 px-4">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center mb-4 border"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--accent)' }}
            >
              <Sparkles className="w-4.5 h-4.5" />
            </div>

            <h2 className="text-[15px] font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
              What do you want to research?
            </h2>
            <p className="text-[13px] max-w-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
              Ask a question or attach a paper. ARES will deploy a team of specialised agents to investigate, code, test, and write it up.
            </p>

            {/* Sample queries — plain, no icons cluttering */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
              {[
                'Compare KAN vs MLP on MNIST classification',
                'Evaluate FlashAttention memory usage at scale',
                'Test sparse attention on long-context transformers',
                'Benchmark knowledge distillation vs pruning on ResNet',
              ].map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setText(sample)}
                  className="p-3 rounded-lg border text-left text-[12px] transition-colors"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-secondary)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--border-strong)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id} className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 border mt-0.5"
                  style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)', color: 'var(--accent)' }}
                >
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}

              <div className={`max-w-[78%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                {/* Bubble */}
                <div
                  className="rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed border"
                  style={{
                    backgroundColor: isUser ? 'var(--accent-subtle)' : 'var(--surface)',
                    borderColor: isUser ? 'transparent' : 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {/* Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {msg.attachments.map((a) => (
                        <span
                          key={a.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border"
                          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                        >
                          {getFileIcon(a.name)}
                          <span className="truncate max-w-[120px]">{a.name}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Post-completion CTA */}
                  {msg.reportId && activeReport && (
                    <div
                      className="mt-2.5 pt-2.5 border-t flex items-center justify-between gap-2"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <span className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--success)' }}>
                        <BookOpen className="w-3 h-3" />
                        {activeReport.citations.length} citations
                      </span>
                      <div className="flex items-center gap-1.5">
                        {onOpenPipeline && (
                          <button
                            type="button"
                            onClick={onOpenPipeline}
                            className="text-[11px] px-2.5 py-1 rounded-md border font-medium transition-colors flex items-center gap-1"
                            style={{
                              backgroundColor: 'var(--surface-secondary)',
                              borderColor: 'var(--border)',
                              color: 'var(--text-secondary)',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                          >
                            <Sparkles className="w-3 h-3" />
                            Pipeline
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={onOpenReportView}
                          className="text-[11px] px-2.5 py-1 rounded-md font-medium text-white flex items-center gap-1"
                          style={{ backgroundColor: 'var(--success)' }}
                        >
                          <FileText className="w-3 h-3" />
                          Report
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <span className="text-[10px] mt-1 px-0.5" style={{ color: 'var(--text-muted)' }}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {isUser && (
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 border mt-0.5"
                  style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }}
                >
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}

        {/* Processing indicator */}
        {isLoading && (
          <div className="flex gap-2.5 justify-start">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 border mt-0.5"
              style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)', color: 'var(--accent)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent)' }} />
            </div>
            <div
              className="rounded-xl px-3.5 py-2.5 border flex items-center justify-between gap-4 max-w-sm"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                {activeStatusMessage || 'Agents running…'}
              </p>
              {onOpenPipeline && (
                <button
                  type="button"
                  onClick={onOpenPipeline}
                  className="text-[11px] px-2 py-0.5 rounded-md font-medium text-white shrink-0 flex items-center gap-1"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  <ArrowRight className="w-3 h-3" />
                  Watch
                </button>
              )}
            </div>
          </div>
        )}

        <div ref={scrollBottomRef} />
      </div>

      {/* ── Composer ── */}
      <div className="shrink-0 pt-2 pb-1">
        {error && (
          <div
            className="mb-2 px-3 py-2 rounded-lg text-[12px] flex items-center justify-between border"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--error)', color: 'var(--error)' }}
          >
            <div className="flex items-center gap-2 truncate">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{error}</span>
            </div>
            <button type="button" onClick={() => setError(null)}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
          onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) handleValidateAndAdd(e.dataTransfer.files); }}
          className="rounded-xl border transition-all"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: isDragging ? 'var(--accent)' : 'var(--border)',
            boxShadow: isDragging ? '0 0 0 2px var(--accent-subtle)' : 'none',
          }}
        >
          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
              {attachments.map((file) => (
                <div
                  key={file.id}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] border"
                  style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  {getFileIcon(file.name)}
                  <span className="font-mono truncate max-w-[120px]">{file.name}</span>
                  <button type="button" onClick={() => handleRemoveAttachment(file.id)} className="text-red-400 hover:text-red-500">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input row */}
          <div className="flex items-end gap-1.5 px-3 py-2">
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.txt,.md,.js,.jsx,.json,.py,.html,.css" onChange={handleFileChange} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              title="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question or describe a hypothesis…"
              rows={1}
              disabled={isLoading}
              className="flex-1 bg-transparent border-0 resize-none py-1 px-1 text-[13px] focus:outline-none leading-relaxed"
              style={{
                color: 'var(--text-primary)',
                minHeight: 28,
                maxHeight: 140,
              }}
            />

            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={(!text.trim() && attachments.length === 0) || isLoading}
              className="p-2 rounded-lg text-white transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="px-3 pb-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Enter to send · Shift+Enter for newline · PDF, DOCX, PY, JSON supported
          </p>
        </div>
      </div>
    </div>
  );
};
