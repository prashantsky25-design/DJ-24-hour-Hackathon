import React, { useRef, useEffect, useState } from 'react';
import { AgentDiscussionMessage } from '../../types/discussion';
import {
  Users, Bot, Shield, FileText, CheckCircle2, Search, Edit3,
  Cpu, FlaskConical, BarChart3, Zap, AlertTriangle, Info,
  CheckCheck, XCircle, TrendingUp, BrainCircuit, Activity,
} from 'lucide-react';

interface WarRoomProps {
  discussions: AgentDiscussionMessage[];
}

// ── Role palette ─────────────────────────────────────────────────────────────
const ROLE_META: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  planner:       { color: '#818CF8', bg: 'rgba(129,140,248,0.10)', border: 'rgba(129,140,248,0.25)', icon: <BrainCircuit className="w-4 h-4" /> },
  researcher:    { color: '#34D399', bg: 'rgba(52,211,153,0.10)',  border: 'rgba(52,211,153,0.25)',  icon: <Search className="w-4 h-4" /> },
  critic:        { color: '#F87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.25)', icon: <Shield className="w-4 h-4" /> },
  drafter:       { color: '#FBBF24', bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.25)',  icon: <Edit3 className="w-4 h-4" /> },
  analyst:       { color: '#C084FC', bg: 'rgba(192,132,252,0.10)', border: 'rgba(192,132,252,0.25)', icon: <BarChart3 className="w-4 h-4" /> },
  'model trainer':    { color: '#22D3EE', bg: 'rgba(34,211,238,0.10)',  border: 'rgba(34,211,238,0.25)',  icon: <Cpu className="w-4 h-4" /> },
  'hyperparam tuner': { color: '#A78BFA', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.25)', icon: <FlaskConical className="w-4 h-4" /> },
  evaluator:     { color: '#4ADE80', bg: 'rgba(74,222,128,0.10)',  border: 'rgba(74,222,128,0.25)',  icon: <TrendingUp className="w-4 h-4" /> },
  'peer reviewer':    { color: '#FB923C', bg: 'rgba(251,146,60,0.10)',  border: 'rgba(251,146,60,0.25)',  icon: <Activity className="w-4 h-4" /> },
  system:        { color: '#94A3B8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.18)', icon: <Zap className="w-4 h-4" /> },
};

function getRoleMeta(role: string) {
  const key = role.toLowerCase();
  for (const k of Object.keys(ROLE_META)) {
    if (key.includes(k)) return ROLE_META[k];
  }
  return { color: '#94A3B8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.18)', icon: <Users className="w-4 h-4" /> };
}

// ── Message type badge ────────────────────────────────────────────────────────
const TYPE_BADGE: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  decision:  { label: 'DECISION',  color: '#818CF8', icon: <BrainCircuit className="w-3 h-3" /> },
  action:    { label: 'ACTION',    color: '#22D3EE', icon: <Zap className="w-3 h-3" /> },
  critique:  { label: 'CRITIQUE',  color: '#F87171', icon: <XCircle className="w-3 h-3" /> },
  approval:  { label: 'APPROVAL',  color: '#4ADE80', icon: <CheckCheck className="w-3 h-3" /> },
  plan:      { label: 'PLAN',      color: '#FBBF24', icon: <FileText className="w-3 h-3" /> },
  research:  { label: 'RESEARCH',  color: '#34D399', icon: <Search className="w-3 h-3" /> },
  draft:     { label: 'DRAFT',     color: '#C084FC', icon: <Edit3 className="w-3 h-3" /> },
  analysis:  { label: 'ANALYSIS',  color: '#A78BFA', icon: <BarChart3 className="w-3 h-3" /> },
  info:      { label: 'INFO',      color: '#94A3B8', icon: <Info className="w-3 h-3" /> },
  warning:   { label: 'WARN',      color: '#FBBF24', icon: <AlertTriangle className="w-3 h-3" /> },
  success:   { label: 'SUCCESS',   color: '#4ADE80', icon: <CheckCircle2 className="w-3 h-3" /> },
  escape:    { label: '⚡ ESCAPE OVERRIDE', color: '#F97316', icon: <Zap className="w-3 h-3" /> },
};

function getTypeMeta(type: string) {
  return TYPE_BADGE[type] ?? { label: type.toUpperCase(), color: '#94A3B8', icon: <Bot className="w-3 h-3" /> };
}

// ── Avatar initials ───────────────────────────────────────────────────────────
function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── Highlight @ mentions and metric numbers ───────────────────────────────────
function HighlightedContent({ text, accentColor }: { text: string; accentColor: string }) {
  // Split on @mentions and metric patterns (numbers with % or = sign)
  const parts = text.split(/(@\w+|(?<!\w)\d+\.\d+%?|p=\d+\.\d+|\+\d+\.\d+pp|\-\d+\.\d+pp)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (/^@\w+/.test(part)) {
          return <span key={i} style={{ color: accentColor, fontWeight: 700 }}>{part}</span>;
        }
        if (/(\d+\.\d+%?|p=\d+\.\d+|[+-]\d+\.\d+pp)/.test(part)) {
          return <span key={i} style={{ color: '#FBBF24', fontWeight: 600, fontFamily: 'monospace', fontSize: '0.9em' }}>{part}</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

// ── Inline metric widget (for trainer messages with epoch data) ───────────────
function EpochWidget({ content }: { content: string }) {
  // Extract train_loss=X and val_loss=X and acc=X from message
  const trainMatch = content.match(/train(?:_loss)?=(\d+\.\d+)/);
  const valMatch   = content.match(/val(?:_loss)?=(\d+\.\d+)/);
  const accMatch   = content.match(/acc(?:uracy)?=(\d+\.\d+)/);
  if (!trainMatch && !valMatch) return null;

  const bars = [
    trainMatch && { label: 'Train Loss', val: parseFloat(trainMatch[1]), color: '#22D3EE', max: 2.0 },
    valMatch   && { label: 'Val Loss',   val: parseFloat(valMatch[1]),   color: '#F87171', max: 2.0 },
    accMatch   && { label: 'Accuracy',   val: parseFloat(accMatch[1]),   color: '#4ADE80', max: 100 },
  ].filter(Boolean) as { label: string; val: number; color: string; max: number }[];

  return (
    <div className="mt-2 space-y-1 rounded-lg p-2" style={{ backgroundColor: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
      {bars.map(b => (
        <div key={b.label} className="flex items-center gap-2">
          <span style={{ width: 70, fontSize: 9, color: '#94A3B8', flexShrink: 0, fontFamily: 'monospace' }}>{b.label}</span>
          <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, (b.val / b.max) * 100)}%`, backgroundColor: b.color }}
            />
          </div>
          <span style={{ width: 40, fontSize: 9, color: b.color, textAlign: 'right', fontFamily: 'monospace' }}>{b.val}</span>
        </div>
      ))}
    </div>
  );
}

// ── Live typing indicator ─────────────────────────────────────────────────────
function TypingDots({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1 h-1 rounded-full"
          style={{
            backgroundColor: color,
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ── Agent stat pill ───────────────────────────────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex flex-col items-center px-2 py-1 rounded-lg" style={{ backgroundColor: `${color}12`, border: `1px solid ${color}25` }}>
      <span style={{ fontSize: 9, color: '#71717A', fontFamily: 'monospace' }}>{label}</span>
      <span style={{ fontSize: 11, color, fontWeight: 700, fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}

export const WarRoom: React.FC<WarRoomProps> = ({ discussions }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [discussions, autoScroll]);

  // Unique agents on the board
  const agentsSeen = Array.from(
    new Map(discussions.map(d => [d.agent_name, d])).values()
  ).filter(d => d.agent_name !== 'System');

  // Filter options
  const msgTypes = ['all', 'critique', 'analysis', 'decision', 'approval', 'action'];

  const filtered = filter === 'all'
    ? discussions
    : discussions.filter(d => d.message_type === filter);

  // Counters
  const counts = {
    critique: discussions.filter(d => d.message_type === 'critique').length,
    approval: discussions.filter(d => d.message_type === 'approval').length,
    analysis: discussions.filter(d => d.message_type === 'analysis').length,
  };

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{ backgroundColor: '#0A0A0A', borderRadius: 12, border: '1px solid #1A1A1A' }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-4 py-3 border-b flex items-center gap-3"
        style={{ borderColor: '#1A1A1A', backgroundColor: '#0D0D0D' }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold tracking-wider text-zinc-100">AGENT WAR ROOM</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: '#1E1E1E', color: '#71717A' }}>
            {discussions.length} msgs
          </span>
        </div>

        {/* Live agent avatars */}
        <div className="flex items-center gap-1 shrink-0">
          {agentsSeen.slice(0, 6).map(a => {
            const meta = getRoleMeta(a.agent_role);
            return (
              <div
                key={a.agent_name}
                title={`${a.agent_name} (${a.agent_role})`}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold cursor-default"
                style={{ backgroundColor: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
              >
                {getInitials(a.agent_name)}
              </div>
            );
          })}
          {agentsSeen.length > 6 && (
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px]" style={{ background: '#1E1E1E', color: '#71717A' }}>
              +{agentsSeen.length - 6}
            </div>
          )}
        </div>
      </div>

      {/* ── Stats bar ──────────────────────────────────────────────────── */}
      {discussions.length > 0 && (
        <div className="shrink-0 px-4 py-2 flex items-center gap-2 border-b" style={{ borderColor: '#141414' }}>
          <StatPill label="REVIEWS"  value={counts.critique} color="#F87171" />
          <StatPill label="APPROVED" value={counts.approval} color="#4ADE80" />
          <StatPill label="ANALYSES" value={counts.analysis} color="#A78BFA" />
          <div className="flex-1" />
          {/* Filter chips */}
          <div className="flex items-center gap-1">
            {msgTypes.map(t => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className="px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide transition-colors"
                style={{
                  background: filter === t ? '#1E2D40' : 'transparent',
                  color: filter === t ? '#60A5FA' : '#52525B',
                  border: `1px solid ${filter === t ? '#60A5FA44' : '#252525'}`,
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Message stream ─────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#2A2A2A #0A0A0A' }}
        onScroll={e => {
          const el = e.currentTarget;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
          setAutoScroll(atBottom);
        }}
      >
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 space-y-3 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
            >
              <Users className="w-7 h-7 text-indigo-500 opacity-40" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-400">Agents standing by</p>
              <p className="text-[11px] text-zinc-600 mt-0.5">Submit a research query to activate the multi-agent cluster</p>
            </div>
          </div>
        )}

        {filtered.map((msg, idx) => {
          const roleMeta = getRoleMeta(msg.agent_role);
          const typeMeta = getTypeMeta(msg.message_type);
          const isSystem = msg.agent_name === 'System';
          const showEpochWidget = msg.agent_role.toLowerCase().includes('trainer') &&
                                  (msg.content.includes('train') || msg.content.includes('val'));

          if (isSystem) {
            // System announcements — centered banner style
            return (
              <div key={msg.id} className="flex items-center gap-2 my-2">
                <div className="flex-1 h-px" style={{ backgroundColor: '#1E1E1E' }} />
                <div
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono shrink-0"
                  style={{ background: `${typeMeta.color}12`, color: typeMeta.color, border: `1px solid ${typeMeta.color}28` }}
                >
                  {typeMeta.icon}
                  <span>{msg.content}</span>
                </div>
                <div className="flex-1 h-px" style={{ backgroundColor: '#1E1E1E' }} />
              </div>
            );
          }

          // Regular agent message
          const isLast = idx === filtered.length - 1;
          return (
            <div
              key={msg.id}
              className="flex gap-2.5 group"
              style={{ animation: 'fadeSlideIn 0.3s ease-out' }}
            >
              {/* Avatar */}
              <div className="shrink-0 flex flex-col items-center gap-1">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold shadow-md"
                  style={{
                    backgroundColor: roleMeta.bg,
                    color: roleMeta.color,
                    border: `1px solid ${roleMeta.border}`,
                  }}
                >
                  {getInitials(msg.agent_name)}
                </div>
                {/* Connecting line if not last */}
                {!isLast && (
                  <div className="w-px flex-1 min-h-[8px]" style={{ backgroundColor: '#1E1E1E' }} />
                )}
              </div>

              {/* Bubble */}
              <div className="flex-1 min-w-0 pb-1">
                {/* Header */}
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-[12px] font-bold" style={{ color: roleMeta.color }}>
                    {msg.agent_name}
                  </span>
                  <span
                    className="text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded-md"
                    style={{ color: roleMeta.color, background: roleMeta.bg, border: `1px solid ${roleMeta.border}` }}
                  >
                    {msg.agent_role}
                  </span>
                  {/* Message type badge */}
                  <span
                    className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md"
                    style={{ color: typeMeta.color, background: `${typeMeta.color}12`, border: `1px solid ${typeMeta.color}28` }}
                  >
                    {typeMeta.icon}
                    <span className="ml-0.5">{typeMeta.label}</span>
                  </span>
                  {/* Confidence */}
                  {msg.confidence != null && msg.confidence < 1.0 && (
                    <span className="text-[9px] font-mono" style={{ color: '#52525B' }}>
                      conf {(msg.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                  <span className="text-[10px] font-mono ml-auto" style={{ color: '#3F3F46' }}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>

                {/* Content */}
                <div
                  className="text-[12.5px] leading-relaxed whitespace-pre-wrap rounded-xl px-3.5 py-2.5"
                  style={{
                    backgroundColor: '#111111',
                    border: `1px solid ${roleMeta.border}`,
                    color: '#D4D4D8',
                    borderLeftColor: roleMeta.color,
                    borderLeftWidth: 2,
                  }}
                >
                  <HighlightedContent text={msg.content} accentColor={roleMeta.color} />
                  {showEpochWidget && <EpochWidget content={msg.content} />}
                </div>

                {/* Reply-to thread hint */}
                {msg.reply_to && (
                  <div className="mt-1 ml-2 text-[10px] font-mono" style={{ color: '#3F3F46' }}>
                    ↩ replying to {msg.reply_to.slice(0, 8)}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Typing indicator — shows when last message is action */}
        {discussions.length > 0 &&
          ['action', 'decision'].includes(discussions[discussions.length - 1]?.message_type) && (
          <div className="flex gap-2.5 items-center pl-10 py-1">
            <TypingDots color={getRoleMeta(discussions[discussions.length - 1].agent_role).color} />
            <span className="text-[10px]" style={{ color: '#3F3F46' }}>
              {discussions[discussions.length - 1].agent_name} is thinking...
            </span>
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-4 py-2 border-t flex items-center justify-between"
        style={{ borderColor: '#141414', backgroundColor: '#0D0D0D' }}
      >
        <div className="flex items-center gap-3 text-[10px] font-mono" style={{ color: '#3F3F46' }}>
          <span>{agentsSeen.length} agents online</span>
          {!autoScroll && (
            <button
              onClick={() => {
                setAutoScroll(true);
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
              }}
              className="px-2 py-0.5 rounded"
              style={{ background: '#1E293B', color: '#60A5FA', border: '1px solid #60A5FA33' }}
            >
              ↓ Jump to latest
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9px] font-mono" style={{ color: '#3F3F46' }}>LIVE</span>
        </div>
      </div>

      {/* ── Animations ─────────────────────────────────────────────────── */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
};
