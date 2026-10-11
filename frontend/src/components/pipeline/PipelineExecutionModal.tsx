/**
 * PipelineExecutionModal
 *
 * Progressive reveal: nodes appear one by one as each agent activates.
 * When agent N becomes 'running', its node fades in and the edge from
 * the previous agent animates into view. Completed agents turn green.
 * Pending agents are hidden — the graph grows with the pipeline.
 *
 * Layout: 78% ReactFlow graph | 22% live log stream
 */
import React, { useMemo, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Edge,
  Node,
  Position,
  Handle,
  NodeProps,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  X,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  ChevronRight,
  Cpu,
  Eye,
  FileCode2,
  Bug,
  FileText,
  Radio,
  Server,
  Zap,
  Sparkles,
  User,
} from 'lucide-react';
import { AgentNodeData } from '../../types/agent';
import { TerminalLogEntry } from '../../types/log';
import { AgentDiscussionMessage } from '../../types/discussion';
import { WarRoom } from '../warroom/WarRoom';
import { aresApi } from '../../services/apiService';

/* ─────────────────────────────────────────────────────────── */
/* Types                                                        */
/* ─────────────────────────────────────────────────────────── */
type StepStatus = 'hidden' | 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

interface PipelineStep {
  id: string;
  label: string;
  agentId: string;
  role: string;           // short subtitle
  status: StepStatus;
  detail?: string;
  /** which step ids are predecessors (must be revealed first) */
  after: string[];
}

interface PipelineExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
  agents: AgentNodeData[];
  logs: TerminalLogEntry[];
  discussions?: AgentDiscussionMessage[];
  query: string;
  pipelineStepMessage: string;
  isProcessing: boolean;
  sessionStatus?: string;
  /** Agent ids this query needs; omitted = show the full pipeline. */
  planAgentIds?: string[];
  /** Whether a report will be produced (controls the footer button). */
  hasReport?: boolean;
}

/* ─────────────────────────────────────────────────────────── */
/* Static pipeline definition (order + topology)               */
/* ─────────────────────────────────────────────────────────── */
const PIPELINE_DEF: Omit<PipelineStep, 'status' | 'detail'>[] = [
  { id: 'user-node',        label: 'User',          role: 'Query submitted',          agentId: 'user-node',        after: [] },
  { id: 'orchestrator',     label: 'Orchestrator',  role: 'Task decomposition',       agentId: 'orchestrator',     after: ['user-node'] },
  { id: 'paper-reader',     label: 'Paper Reader',  role: 'GPT-4o Vision',            agentId: 'paper-reader',     after: ['orchestrator'] },
  { id: 'dynamic-spawner',  label: 'Task Planner',  role: 'Dynamic spawning',         agentId: 'dynamic-spawner',  after: ['orchestrator', 'paper-reader'] },
  { id: 'coding-agent',     label: 'Coding Agent',  role: 'Code synthesis',           agentId: 'coding-agent',     after: ['dynamic-spawner'] },
  { id: 'sandbox-executor', label: 'E2B Sandbox',   role: 'Git-gated execution',      agentId: 'sandbox-executor', after: ['coding-agent'] },
  { id: 'debugging-agent',  label: 'Self-Healer',   role: 'Groq debug loop',          agentId: 'debugging-agent',  after: ['sandbox-executor'] },
  { id: 'drafter-agent',    label: 'Drafter',       role: 'LaTeX / IEEE report',      agentId: 'drafter-agent',    after: ['debugging-agent'] },
];

/* Fixed positions — left-to-right pipeline */
const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  'user-node':        { x:  60, y: 240 },
  'orchestrator':     { x: 280, y: 140 },
  'paper-reader':     { x: 280, y: 340 },
  'dynamic-spawner':  { x: 500, y: 240 },
  'coding-agent':     { x: 720, y: 140 },
  'sandbox-executor': { x: 720, y: 340 },
  'debugging-agent':  { x: 940, y: 240 },
  'drafter-agent':    { x:1160, y: 240 },
};

/* Edges that exist when BOTH endpoints are revealed */
const EDGE_DEFS: [string, string][] = [
  ['user-node',        'orchestrator'],
  ['user-node',        'paper-reader'],
  ['orchestrator',     'dynamic-spawner'],
  ['paper-reader',     'dynamic-spawner'],
  ['dynamic-spawner',  'coding-agent'],
  ['dynamic-spawner',  'sandbox-executor'],
  ['coding-agent',     'debugging-agent'],
  ['sandbox-executor', 'debugging-agent'],
  ['debugging-agent',  'drafter-agent'],
];

/* ─────────────────────────────────────────────────────────── */
/* Helpers                                                      */
/* ─────────────────────────────────────────────────────────── */
function agentIcon(id: string) {
  const cls = 'w-4 h-4 shrink-0';
  if (id.includes('user')) return <User className={cls} style={{ color: '#A78BFA' }} />;
  if (id.includes('orchestrator') || id.includes('planner')) return <Sparkles className={cls} style={{ color: '#818CF8' }} />;
  if (id.includes('researcher') || id.includes('reader')) return <Eye className={cls} style={{ color: '#FBBF24' }} />;
  if (id.includes('spawner') || id.includes('tuner')) return <Zap className={cls} style={{ color: '#22D3EE' }} />;
  if (id.includes('coding') || id.includes('trainer')) return <FileCode2 className={cls} style={{ color: '#34D399' }} />;
  if (id.includes('sandbox')) return <Server className={cls} style={{ color: '#38BDF8' }} />;
  if (id.includes('debug') || id.includes('critic') || id.includes('evaluator')) return <Bug className={cls} style={{ color: '#FB7185' }} />;
  if (id.includes('draft') || id.includes('reviewer')) return <FileText className={cls} style={{ color: '#60A5FA' }} />;
  return <Cpu className={cls} style={{ color: '#94A3B8' }} />;
}

function borderForStatus(s: StepStatus) {
  switch (s) {
    case 'running':   return '#F59E0B';
    case 'completed': return '#22C55E';
    case 'failed':    return '#EF4444';
    default:          return '#3F3F46';
  }
}
function bgForStatus(s: StepStatus) {
  switch (s) {
    case 'running':   return 'rgba(245,158,11,0.10)';
    case 'completed': return 'rgba(34,197,94,0.08)';
    case 'failed':    return 'rgba(239,68,68,0.08)';
    default:          return 'rgba(255,255,255,0.03)';
  }
}
function glowForStatus(s: StepStatus) {
  if (s === 'running')   return '0 0 0 3px rgba(245,158,11,0.25), 0 0 16px rgba(245,158,11,0.12)';
  if (s === 'completed') return '0 0 0 1px rgba(34,197,94,0.30)';
  return 'none';
}

function srcBadge(source: string) {
  switch (source) {
    case 'stdout':  return { label: 'OUT', color: '#34D399' };
    case 'stderr':  return { label: 'ERR', color: '#FB7185' };
    case 'system':  return { label: 'SYS', color: '#818CF8' };
    case 'agent':   return { label: 'AGT', color: '#FBBF24' };
    case 'sandbox': return { label: 'E2B', color: '#38BDF8' };
    default:        return { label: 'LOG', color: '#94A3B8' };
  }
}
function logColor(level: string) {
  switch (level) {
    case 'error': return '#FB7185';
    case 'warn':  return '#FBBF24';
    default:      return '#6B7280';
  }
}

function mapAgentStatus(agent?: AgentNodeData): StepStatus {
  if (!agent) return 'pending';
  switch (agent.status) {
    case 'running':  return 'running';
    case 'spawning': return 'running';
    case 'retired':  return 'completed';
    case 'error':    return 'failed';
    default:         return 'pending';
  }
}

/* ─────────────────────────────────────────────────────────── */
/* Single Flow Node                                             */
/* ─────────────────────────────────────────────────────────── */
const PipelineFlowNode: React.FC<NodeProps> = ({ data }) => {
  const d = data as unknown as PipelineStep & { revealed: boolean };
  const border = borderForStatus(d.status);

  return (
    <div
      style={{
        width: 220,
        backgroundColor: bgForStatus(d.status),
        borderColor: border,
        borderWidth: 1.5,
        borderStyle: 'solid',
        borderRadius: 14,
        boxShadow: glowForStatus(d.status),
        opacity: d.revealed ? 1 : 0,
        transform: d.revealed ? 'scale(1)' : 'scale(0.88)',
        transition: 'opacity 0.4s ease, transform 0.4s ease, border-color 0.3s, box-shadow 0.3s',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ background: border, width: 8, height: 8, border: '2px solid #141414' }}
      />

      <div style={{ padding: '12px 14px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.08)',
            border: `1.5px solid ${border}50`,
          }}>
            {agentIcon(d.agentId)}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#F4F4F5', margin: 0, lineHeight: 1.2 }}>
              {d.label}
            </p>
            <p style={{ fontSize: 10.5, fontWeight: 500, color: '#A1A1AA', margin: 0, marginTop: 2 }}>
              {d.role}
            </p>
          </div>
          {/* Status icon */}
          <div style={{ flexShrink: 0 }}>
            {d.status === 'running'   && <Loader2     style={{ width: 16, height: 16, color: border, animation: 'spin 1s linear infinite' }} />}
            {d.status === 'completed' && <CheckCircle2 style={{ width: 16, height: 16, color: border }} />}
            {d.status === 'failed'    && <AlertCircle  style={{ width: 16, height: 16, color: border }} />}
            {d.status === 'pending'   && <Circle       style={{ width: 14, height: 14, color: '#71717A', opacity: 0.6 }} />}
          </div>
        </div>

        {/* Current task */}
        {d.detail && (
          <p style={{
            fontSize: 10.5,
            color: '#D4D4D8',
            margin: 0,
            lineHeight: 1.45,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}>
            {d.detail}
          </p>
        )}

        {/* Running pulse bar */}
        {d.status === 'running' && (
          <div style={{
            marginTop: 10,
            height: 2.5,
            borderRadius: 99,
            background: `linear-gradient(90deg, transparent, ${border}, transparent)`,
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s ease-in-out infinite',
          }} />
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ background: border, width: 8, height: 8, border: '2px solid #141414' }}
      />
    </div>
  );
};

const nodeTypes = { pipelineNode: PipelineFlowNode };

/* ─────────────────────────────────────────────────────────── */
/* Inner graph (needs ReactFlowProvider context)               */
/* ─────────────────────────────────────────────────────────── */
function PipelineGraph({
  steps,
  revealedIds,
  positions,
  edges,
}: {
  steps: PipelineStep[];
  revealedIds: Set<string>;
  positions: Record<string, { x: number; y: number }>;
  edges: [string, string][];
}) {
  const { fitView } = useReactFlow();

  // Re-fit when new nodes are revealed
  useEffect(() => {
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
  }, [revealedIds.size, fitView]);

  const rfNodes: Node[] = useMemo(() =>
    steps.map(step => ({
      id: step.id,
      type: 'pipelineNode',
      position: positions[step.id] || { x: 0, y: 0 },
      data: {
        ...step,
        revealed: revealedIds.has(step.id),
      },
    }))
  , [steps, revealedIds, positions]);

  const rfEdges: Edge[] = useMemo(() =>
    edges
      .filter(([src, tgt]) => revealedIds.has(src) && revealedIds.has(tgt))
      .map(([src, tgt]) => {
        const srcStep = steps.find(s => s.id === src);
        const isActive = srcStep?.status === 'running' || srcStep?.status === 'completed';
        const edgeColor = srcStep?.status === 'completed' ? '#22C55E'
                        : srcStep?.status === 'running'   ? '#F59E0B'
                        : '#52525B';
        return {
          id: `e-${src}-${tgt}`,
          source: src,
          target: tgt,
          type: 'smoothstep',
          animated: srcStep?.status === 'running',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 14, height: 14,
            color: edgeColor,
          },
          style: {
            stroke: edgeColor,
            strokeWidth: isActive ? 2.5 : 2,
            opacity: 1,
            transition: 'stroke 0.3s, stroke-width 0.3s',
          },
        };
      })
  , [steps, revealedIds, edges]);

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.18, duration: 450 }}
      minZoom={0.55}
      maxZoom={1.25}
      nodesDraggable={true}
      nodesConnectable={false}
      elementsSelectable={false}
      style={{ background: '#0A0A0A' }}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="#1A1A1A" />
      {/* Shimmer keyframes injected once */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </ReactFlow>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* Main Modal                                                   */
/* ─────────────────────────────────────────────────────────── */
export const PipelineExecutionModal: React.FC<PipelineExecutionModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  agents,
  logs,
  discussions,
  query,
  pipelineStepMessage,
  isProcessing,
  sessionStatus,
  planAgentIds,
  hasReport = true,
}) => {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [leftView, setLeftView] = useState<'graph' | 'warroom'>('graph');
  const [isEscaping, setIsEscaping] = useState(false);

  const handleEscape = async () => {
    setIsEscaping(true);
    try {
      const sid = sessionId || aresApi.getSessionId();
      if (sid) {
        await fetch(`http://localhost:8000/api/session/${sid}/escape`, { method: 'POST' });
      }
      // Also invoke global escape endpoint for absolute redundancy
      await fetch('http://localhost:8000/api/escape', { method: 'POST' });
    } catch (e) {
      console.warn('Escape session error:', e);
    } finally {
      setTimeout(() => setIsEscaping(false), 1500);
    }
  };

  /* Auto-scroll logs */
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  /* ── Dynamic Plan: Align workflow to actual agents participating in the task ── */
  const { planDef, positions, edgeDefs } = useMemo(() => {
    const dynamicAgents = [{ id: 'user-node', label: 'User', role: 'Query submitted' }];
    const seen = new Set(['user-node']);
    
    // Add agents from discussions in order of appearance
    (discussions || []).forEach(d => {
      if (d.agent_name === 'System') return; // skip system announcements
      const agentId = d.agent_name.toLowerCase().replace(/\s+/g, '-');
      if (!seen.has(agentId)) {
        seen.add(agentId);
        dynamicAgents.push({
          id: agentId,
          label: d.agent_name,
          role: d.agent_role
        });
      }
    });

    // If no agents have spoken yet, show an Orchestrator starting up
    if (dynamicAgents.length === 1) {
      dynamicAgents.push({ id: 'orchestrator', label: 'Orchestrator', role: 'Task decomposition' });
    }

    // Symmetrical linear horizontal layout: agents pop in and connect dynamically
    const pos: Record<string, { x: number; y: number }> = {};
    dynamicAgents.forEach((a, i) => {
      pos[a.id] = {
        x: 80 + i * 270,
        y: 220,
      };
    });

    const def = dynamicAgents.map((a, i) => ({
      ...a,
      agentId: a.id,
      after: i === 0 ? [] : [dynamicAgents[i - 1].id]
    }));

    const edges: [string, string][] = dynamicAgents.slice(1).map((a, i) => [dynamicAgents[i].id, a.id]);

    return { planDef: def, positions: pos, edgeDefs: edges };
  }, [discussions]);

  /* ── Build live steps directly from discussion state (optimized single-active status) ── */
  const steps: PipelineStep[] = useMemo(() => {
    const isCompleted = !isProcessing || sessionStatus === 'completed' || sessionStatus === 'completed_with_warnings';
    
    // Identify the single most recently active agent who spoke (excluding System)
    const nonSystemMsgs = (discussions || []).filter(d => d.agent_name !== 'System');
    const latestActiveAgentId = nonSystemMsgs.length > 0
      ? nonSystemMsgs[nonSystemMsgs.length - 1].agent_name.toLowerCase().replace(/\s+/g, '-')
      : null;

    return planDef.map(def => {
      if (def.id === 'user-node') {
        return {
          ...def,
          status: 'completed' as StepStatus,
          detail: query ? query.slice(0, 55) + (query.length > 55 ? '…' : '') : 'Query submitted'
        };
      }
      
      const msgs = (discussions || []).filter(d => 
        d.agent_name.toLowerCase().replace(/\s+/g, '-') === def.id
      );
      
      let status: StepStatus = 'pending';
      let detail = '';
      
      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        detail = lastMsg.content.length > 40 ? lastMsg.content.slice(0, 40) + '...' : lastMsg.content;
        
        if (isCompleted) {
          status = 'completed';
        } else {
          // Exactly ONE agent is 'running' at a time; all previous agents are 'completed'
          status = (def.id === latestActiveAgentId) ? 'running' : 'completed';
        }
      } else if (def.id === 'orchestrator') {
        status = isCompleted ? 'completed' : 'running';
        detail = 'Coordinating agent cluster...';
      }
      
      return { ...def, status, detail };
    });
  }, [planDef, discussions, query, isProcessing, sessionStatus]);

  /* ── Progressive reveal: all dynamically created nodes are revealed ── */
  const revealedIds = useMemo<Set<string>>(() => {
    return new Set(planDef.map(d => d.id));
  }, [planDef]);

  /* Overall progress (only count non-hidden steps) */
  const completedCount = steps.filter(s => s.status === 'completed').length;
  const visibleCount   = revealedIds.size;
  const progress = Math.round((completedCount / planDef.length) * 100);
  const isDone   = !isProcessing && (sessionStatus === 'completed' || sessionStatus === 'completed_with_warnings');
  const isFailed = sessionStatus === 'error';

  /* Active agent name for header */
  const activeStep = steps.find(s => s.status === 'running');

  /* Auto-close for queries that do not generate a report (like chat) */
  useEffect(() => {
    if (isOpen && isDone && !hasReport) {
      const timer = setTimeout(() => {
        onClose();
      }, 800); // short delay to see the green completion state
      return () => clearTimeout(timer);
    }
  }, [isOpen, isDone, hasReport, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(5px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full flex flex-col animate-slide-up overflow-hidden"
        style={{
          maxWidth: 1200,
          height: '90vh',
          backgroundColor: '#111111',
          border: '1px solid #222222',
          borderRadius: 14,
        }}
      >
        {/* ─── Modal Header ──────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0 border-b"
          style={{ borderColor: '#222222', backgroundColor: '#141414' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Live dot */}
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${isProcessing ? 'animate-pulse' : ''}`}
              style={{
                backgroundColor: isFailed ? '#EF4444' : isDone ? '#22C55E' : isProcessing ? '#F59E0B' : '#52525B',
              }}
            />
            <span className="text-[13px] font-semibold text-white shrink-0">
              {isFailed ? 'Pipeline Failed' : isDone ? 'Pipeline Complete' : isProcessing ? 'Running' : 'Pipeline'}
            </span>
            {activeStep && (
              <>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: '#3F3F46' }} />
                <span className="text-[11px] truncate" style={{ color: '#F59E0B' }}>
                  {activeStep.label} — {activeStep.detail?.slice(0, 60) ?? '…'}
                </span>
              </>
            )}
            {!activeStep && query && (
              <>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: '#3F3F46' }} />
                <span className="text-[11px] truncate max-w-xs" style={{ color: '#52525B' }}>
                  {query.slice(0, 72)}{query.length > 72 ? '…' : ''}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Progress */}
            <span className="text-[10px] font-mono" style={{ color: '#52525B' }}>
              {completedCount}/{planDef.length}
            </span>
            <div className="w-24 h-1 rounded-full overflow-hidden" style={{ background: '#2A2A2A' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progress}%`,
                  background: isDone ? '#22C55E' : isFailed ? '#EF4444' : '#6366F1',
                }}
              />
            </div>
            <span className="text-[11px] font-mono w-8 text-right" style={{
              color: isDone ? '#22C55E' : isFailed ? '#EF4444' : '#6366F1',
            }}>
              {progress}%
            </span>
            {/* Revealed count badge */}
            <span className="text-[10px] px-2 py-0.5 rounded" style={{
              background: '#1E1E1E', color: '#52525B', border: '1px solid #2A2A2A',
            }}>
              {visibleCount} agents active
            </span>

            {/* Escape Impasse Override Button */}
            {isProcessing && (
              <button
                onClick={handleEscape}
                disabled={isEscaping}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold transition-all shadow-sm active:scale-95"
                style={{
                  background: isEscaping ? '#27272A' : '#7C2D12',
                  color: isEscaping ? '#A1A1AA' : '#FDBA74',
                  border: '1px solid #EA580C',
                }}
                title="Break agent debate deadlock and force advance pipeline directly to report finalization"
              >
                <Zap className="w-3.5 h-3.5 fill-current text-amber-400" />
                {isEscaping ? 'Escaping...' : 'Escape Impasse'}
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-md transition-colors"
              style={{ color: '#52525B' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#E4E4E7'; e.currentTarget.style.backgroundColor = '#222222'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#52525B'; e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─── Body: 78/22 split ─────────────────────── */}
        <div className="flex flex-1 min-h-0">

          {/* ── LEFT: Progressive ReactFlow graph ──── */}
          <div
            className="flex flex-col min-h-0"
            style={{ width: '78%', borderRight: '1px solid #1E1E1E' }}
          >
            {/* Subheader */}
            <div
              className="flex items-center gap-3 px-4 py-2 shrink-0 border-b"
              style={{ borderColor: '#1A1A1A', backgroundColor: '#0F0F0F' }}
            >
              <span className="text-[9px] uppercase tracking-widest font-semibold flex items-center gap-3" style={{ color: '#3F3F46' }}>
                <button
                  onClick={() => setLeftView('graph')}
                  className="hover:text-white transition-colors"
                  style={{ color: leftView === 'graph' ? '#E4E4E7' : '#71717A' }}
                >
                  AGENT WORKFLOW
                </button>
                <button
                  onClick={() => setLeftView('warroom')}
                  className="hover:text-white transition-colors"
                  style={{ color: leftView === 'warroom' ? '#E4E4E7' : '#71717A' }}
                >
                  WAR ROOM
                </button>
              </span>
              {pipelineStepMessage && leftView === 'graph' && (
                <span className="text-[11px] truncate" style={{ color: '#71717A' }}>
                  {pipelineStepMessage}
                </span>
              )}
              {/* Mini legend */}
              <div className="ml-auto flex items-center gap-3 text-[9px]" style={{ color: '#3F3F46' }}>
                {[
                  { color: '#52525B', label: 'Pending' },
                  { color: '#F59E0B', label: 'Running' },
                  { color: '#22C55E', label: 'Done' },
                ].map(l => (
                  <span key={l.label} className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: l.color }} />
                    {l.label}
                  </span>
                ))}
              </div>
            </div>

            {/* ReactFlow / WarRoom */}
            <div className="flex-1 min-h-0">
              {leftView === 'graph' ? (
                <ReactFlowProvider>
                  <PipelineGraph steps={steps} revealedIds={revealedIds} positions={positions} edges={edgeDefs} />
                </ReactFlowProvider>
              ) : (
                <div style={{ height: '100%', overflowY: 'auto' }}>
                  <WarRoom discussions={discussions || []} />
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Live logs panel ──────────────── */}
          <div className="flex flex-col min-h-0" style={{ width: '22%' }}>
            <div
              className="flex items-center justify-between px-3 py-2 shrink-0 border-b"
              style={{ borderColor: '#1A1A1A', backgroundColor: '#0F0F0F' }}
            >
              <span className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: '#3F3F46' }}>
                Live Logs
              </span>
              <button
                onClick={() => setAutoScroll(v => !v)}
                style={{
                  fontSize: 9,
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: autoScroll ? '#1E293B' : 'transparent',
                  color: autoScroll ? '#60A5FA' : '#52525B',
                  border: '1px solid #2A2A2A',
                  cursor: 'pointer',
                }}
              >
                {autoScroll ? '↓ live' : '↓ off'}
              </button>
            </div>

            <div
              className="flex-1 overflow-y-auto"
              style={{ fontSize: 10, fontFamily: 'monospace', lineHeight: 1.6 }}
              onScroll={e => {
                const el = e.currentTarget;
                setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
              }}
            >
              {logs.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <p style={{ fontSize: 10, color: '#3F3F46', textAlign: 'center', padding: '0 12px' }}>
                    Waiting for logs…
                  </p>
                </div>
              ) : (
                <div style={{ paddingTop: 4, paddingBottom: 4 }}>
                  {logs.slice(-250).map(log => {
                    const src = srcBadge(log.source);
                    return (
                      <div
                        key={log.id}
                        style={{
                          display: 'flex',
                          gap: 6,
                          alignItems: 'flex-start',
                          padding: '2px 8px',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{
                          flexShrink: 0,
                          fontSize: 8.5,
                          padding: '0 4px',
                          borderRadius: 3,
                          fontWeight: 700,
                          color: src.color,
                          background: `${src.color}18`,
                          border: `1px solid ${src.color}28`,
                          lineHeight: '14px',
                          marginTop: 1,
                        }}>
                          {src.label}
                        </span>
                        <span style={{
                          wordBreak: 'break-all',
                          color: logColor(log.level),
                        }}>
                          {log.message}
                        </span>
                      </div>
                    );
                  })}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>

            <div
              style={{
                padding: '5px 12px',
                borderTop: '1px solid #1A1A1A',
                fontSize: 9,
                fontFamily: 'monospace',
                color: '#3F3F46',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{logs.length} entries</span>
              {isProcessing && <span style={{ color: '#F59E0B' }}>● recording</span>}
            </div>
          </div>
        </div>

        {/* ─── Footer ────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-2 shrink-0 border-t"
          style={{ borderColor: '#1E1E1E', backgroundColor: '#0D0D0D' }}
        >
          {/* Step pipeline dots */}
          <div className="flex items-center gap-2">
            {planDef.map((def, i) => {
              const step = steps.find(s => s.id === def.id)!;
              const revealed = revealedIds.has(def.id);
              const color = !revealed       ? '#1E1E1E'
                          : step.status === 'running'   ? '#F59E0B'
                          : step.status === 'completed' ? '#22C55E'
                          : step.status === 'failed'    ? '#EF4444'
                          : '#3F3F46';
              return (
                <React.Fragment key={def.id}>
                  {i > 0 && (
                    <div style={{
                      width: 12, height: 1,
                      background: revealed ? '#3F3F46' : '#1E1E1E',
                      transition: 'background 0.3s',
                      flexShrink: 0,
                    }} />
                  )}
                  <div
                    title={def.label}
                    style={{
                      width: step.status === 'running' ? 10 : 7,
                      height: step.status === 'running' ? 10 : 7,
                      borderRadius: '50%',
                      background: color,
                      transition: 'all 0.3s',
                      flexShrink: 0,
                      animation: step.status === 'running' ? 'pulse 1s ease-in-out infinite' : 'none',
                    }}
                  />
                </React.Fragment>
              );
            })}
          </div>

          <div className="flex items-center gap-3 text-[10px] font-mono" style={{ color: '#52525B' }}>
            {isProcessing && (
              <span className="flex items-center gap-1.5" style={{ color: '#F59E0B' }}>
                <Loader2 className="w-3 h-3 animate-spin" />
                executing
              </span>
            )}
            {isDone && (
              <span className="flex items-center gap-1.5" style={{ color: '#22C55E' }}>
                <CheckCircle2 className="w-3 h-3" />
                all agents done
              </span>
            )}
            {isFailed && (
              <span className="flex items-center gap-1.5" style={{ color: '#EF4444' }}>
                <AlertCircle className="w-3 h-3" />
                pipeline failed
              </span>
            )}
            {isDone && (
              <button
                onClick={onClose}
                style={{
                  padding: '3px 12px',
                  borderRadius: 6,
                  background: '#22C55E',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                {hasReport ? 'View Report →' : 'Close'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
