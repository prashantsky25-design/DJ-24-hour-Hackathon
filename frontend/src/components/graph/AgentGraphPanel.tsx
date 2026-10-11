import React, { useMemo, useState, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Edge,
  Node,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AgentNodeData } from '../../types/agent';
import { ResearchReport } from '../../types/research';
import { CustomAgentNode } from './CustomAgentNode';
import { UserNode } from './UserNode';
import { ReportDeliveryNode } from './ReportDeliveryNode';
import { AgentDetailDrawer } from './AgentDetailDrawer';
import { Network, Filter, RotateCcw, Info, ChevronRight } from 'lucide-react';

interface AgentGraphPanelProps {
  agents: AgentNodeData[];
  onSelectAgent?: (agentId: string) => void;
  selectedAgentId?: string | null;
  activeQuery?: string;
  attachedDocsCount?: number;
  report?: ResearchReport | null;
  onOpenReport?: () => void;
}

const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  'orchestrator':     { x: 380, y: 180 },
  'paper-reader':     { x: 60,  y: 340 },
  'dynamic-spawner':  { x: 380, y: 340 },
  'arxiv-radar':      { x: 60,  y: 520 },
  'coding-agent':     { x: 380, y: 520 },
  'debugging-agent':  { x: 740, y: 340 },
  'sandbox-executor': { x: 740, y: 520 },
  'drafter-agent':    { x: 760, y: 180 },
};

const FILTER_TABS = ['all', 'running', 'spawning', 'idle', 'retired'] as const;
type FilterStatus = (typeof FILTER_TABS)[number];

export const AgentGraphPanel: React.FC<AgentGraphPanelProps> = ({
  agents,
  onSelectAgent,
  selectedAgentId,
  activeQuery,
  attachedDocsCount = 0,
  report,
  onOpenReport,
}) => {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [inspectedAgentId, setInspectedAgentId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const nodeTypes = useMemo(
    () => ({ agentNode: CustomAgentNode, userNode: UserNode, reportNode: ReportDeliveryNode }),
    [],
  );

  /* ── Nodes ── */
  const nodes: Node[] = useMemo(() => {
    const list: Node[] = [];

    // User + Report nodes always visible — filter only applies to agent nodes
    list.push({
      id: 'user-node',
      type: 'userNode',
      position: { x: 380, y: 20 },
      data: {
        label: 'Human Researcher',
        role: 'Client Initiator & Evaluator',
        activeQuery: activeQuery || 'Awaiting research query…',
        attachedDocsCount,
        status: report ? 'reviewing' : activeQuery ? 'active' : 'idle',
      },
      selected: inspectedAgentId === 'user-node',
    });

    list.push({
      id: 'report-delivery-node',
      type: 'reportNode',
      position: { x: 760, y: 20 },
      data: {
        title: report?.title || 'Synthesis Report (Awaiting Completion)',
        citationsCount: report?.citations?.length || 5,
        status: report ? 'ready' : 'pending',
        onOpenReport,
      },
      selected: inspectedAgentId === 'report-delivery-node',
    });

    // Agent nodes — filtered by status (filter only hides agents, never the user/report nodes)
    agents
      .filter((ag) => filterStatus === 'all' || ag.status === filterStatus)
      .forEach((agent) => {
        list.push({
          id: agent.id,
          type: 'agentNode',
          position: NODE_POSITIONS[agent.id] ?? { x: 200, y: 300 },
          data: agent as unknown as Record<string, unknown>,
          selected: inspectedAgentId === agent.id,
        });
      });

    return list;
  }, [agents, filterStatus, inspectedAgentId, activeQuery, attachedDocsCount, report, onOpenReport]);

  /* ── Edges ── */
  const edges: Edge[] = useMemo(() => [
    {
      id: 'e-user-orch', source: 'user-node', target: 'orchestrator', animated: true,
      style: { stroke: '#6366f1', strokeWidth: 2 },
      label: 'Inquire', labelStyle: { fill: '#818cf8', fontSize: 9, fontFamily: 'monospace', fontWeight: 600 },
      labelBgStyle: { fill: 'var(--surface)', rx: 4, ry: 4 },
    },
    {
      id: 'e-orch-reader', source: 'orchestrator', target: 'paper-reader', animated: true,
      style: { stroke: '#818cf8', strokeWidth: 1.5 },
      label: 'Parse Context', labelStyle: { fill: '#94a3b8', fontSize: 9, fontFamily: 'monospace' },
      labelBgStyle: { fill: 'var(--surface)', rx: 4, ry: 4 },
    },
    {
      id: 'e-orch-spawner', source: 'orchestrator', target: 'dynamic-spawner', animated: true,
      style: { stroke: '#818cf8', strokeWidth: 1.5 },
      label: 'Task Plan', labelStyle: { fill: '#94a3b8', fontSize: 9, fontFamily: 'monospace' },
      labelBgStyle: { fill: 'var(--surface)', rx: 4, ry: 4 },
    },
    {
      id: 'e-reader-spawner', source: 'paper-reader', target: 'dynamic-spawner', animated: true,
      style: { stroke: '#06b6d4', strokeWidth: 1.5 },
      label: 'Citations', labelStyle: { fill: '#06b6d4', fontSize: 9, fontFamily: 'monospace' },
      labelBgStyle: { fill: 'var(--surface)', rx: 4, ry: 4 },
    },
    {
      id: 'e-spawner-coder', source: 'dynamic-spawner', target: 'coding-agent', animated: true,
      style: { stroke: '#10b981', strokeWidth: 1.5 },
      label: 'Patch', labelStyle: { fill: '#10b981', fontSize: 9, fontFamily: 'monospace' },
      labelBgStyle: { fill: 'var(--surface)', rx: 4, ry: 4 },
    },
    {
      id: 'e-coder-sandbox', source: 'coding-agent', target: 'sandbox-executor', animated: true,
      style: { stroke: '#38bdf8', strokeWidth: 1.5 },
      label: 'Run', labelStyle: { fill: '#38bdf8', fontSize: 9, fontFamily: 'monospace' },
      labelBgStyle: { fill: 'var(--surface)', rx: 4, ry: 4 },
    },
    {
      id: 'e-sandbox-debugger', source: 'sandbox-executor', target: 'debugging-agent',
      style: { stroke: '#fb7185', strokeDasharray: '4 4', strokeWidth: 1.5 },
      label: 'Audit', labelStyle: { fill: '#fda4af', fontSize: 9, fontFamily: 'monospace' },
      labelBgStyle: { fill: 'var(--surface)', rx: 4, ry: 4 },
    },
    {
      id: 'e-debugger-drafter', source: 'debugging-agent', target: 'drafter-agent', animated: true,
      style: { stroke: '#a78bfa', strokeWidth: 1.5 },
      label: 'Approved', labelStyle: { fill: '#c4b5fd', fontSize: 9, fontFamily: 'monospace' },
      labelBgStyle: { fill: 'var(--surface)', rx: 4, ry: 4 },
    },
    {
      id: 'e-drafter-report', source: 'drafter-agent', target: 'report-delivery-node', animated: true,
      style: { stroke: '#10b981', strokeWidth: 2 },
      label: 'Deliver', labelStyle: { fill: '#10b981', fontSize: 9, fontFamily: 'monospace', fontWeight: 600 },
      labelBgStyle: { fill: 'var(--surface)', rx: 4, ry: 4 },
    },
    {
      id: 'e-report-user', source: 'report-delivery-node', target: 'user-node',
      animated: Boolean(report),
      style: { stroke: '#10b981', strokeWidth: 2, strokeDasharray: report ? undefined : '5 5' },
      label: 'To User', labelStyle: { fill: '#10b981', fontSize: 9, fontFamily: 'monospace', fontWeight: 600 },
      labelBgStyle: { fill: 'var(--surface)', rx: 4, ry: 4 },
    },
  ], [report]);

  /* ── Handlers ── */
  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    if (node.id === 'report-delivery-node' && onOpenReport) {
      onOpenReport();
      return;
    }
    setInspectedAgentId((prev) => prev === node.id ? null : node.id);
    onSelectAgent?.(node.id);
  };

  const inspectedAgent = agents.find((a) => a.id === inspectedAgentId) ?? null;

  const counts = useMemo(() => ({
    all:      agents.length,
    running:  agents.filter((a) => a.status === 'running').length,
    spawning: agents.filter((a) => a.status === 'spawning').length,
    idle:     agents.filter((a) => a.status === 'idle').length,
    retired:  agents.filter((a) => a.status === 'retired').length,
  }), [agents]);

  // Live running count badge
  const liveCount = counts.running + counts.spawning;

  return (
    <div
      ref={panelRef}
      className="relative w-full rounded-xl border overflow-hidden flex flex-col"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
        minHeight: 540,
      }}
    >
      {/* ── Control bar ── */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b shrink-0 z-10"
        style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)' }}
      >
        {/* Title */}
        <div className="flex items-center gap-2">
          <Network className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
          <span className="text-xs font-bold uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Evolving AI Agent Graph
          </span>
          <span className="text-[10px] hidden sm:inline font-mono" style={{ color: 'var(--text-muted)' }}>
            Closed-Loop Architecture
          </span>
          {/* Live badge */}
          {liveCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {liveCount} live
            </span>
          )}
        </div>

        {/* Filter pill-group */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <Filter className="w-3 h-3" />
            <span className="hidden sm:inline">Filter:</span>
          </div>
          <div
            className="flex items-center rounded-lg p-0.5 border gap-0.5"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            {FILTER_TABS.map((st) => {
              const active = filterStatus === st;
              return (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md transition-all"
                  style={{
                    backgroundColor: active ? 'var(--accent)' : 'transparent',
                    color: active ? '#fff' : 'var(--text-secondary)',
                    fontSize: 10,
                    fontWeight: active ? 700 : 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'var(--hover)'; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <span>{st}</span>
                  <span className="text-[9px] px-1 rounded font-mono"
                    style={{
                      backgroundColor: active ? 'rgba(255,255,255,0.22)' : 'var(--border)',
                      color: active ? '#fff' : 'var(--text-muted)',
                    }}>
                    {counts[st]}
                  </span>
                </button>
              );
            })}
          </div>
          {filterStatus !== 'all' && (
            <button onClick={() => setFilterStatus('all')}
              className="p-1 rounded-md transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              title="Reset filter">
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── Canvas ── */}
      <div
        className="relative"
        style={{ backgroundColor: 'var(--graph-bg)', height: 460 }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.3}
          maxZoom={1.8}
          style={{ width: '100%', height: '100%' }}
        >
          <Background color="var(--graph-grid)" gap={22} size={1.5} variant={BackgroundVariant.Dots} />
          <Controls 
            position="top-left"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }} 
          />
          <MiniMap
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            nodeColor={(n) => {
              if (n.id === 'user-node') return '#6366f1';
              if (n.id === 'report-delivery-node') return '#10b981';
              const d = n.data as unknown as AgentNodeData;
              if (d?.status === 'running')  return '#10b981';
              if (d?.status === 'spawning') return '#f59e0b';
              if (d?.status === 'retired')  return '#8b5cf6';
              return '#94a3b8';
            }}
          />
        </ReactFlow>

        {/* Legend — bottom-left float */}
        <div className="absolute bottom-3 left-3 z-10 rounded-xl border p-2.5 hidden md:block pointer-events-none"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider mb-1.5"
            style={{ color: 'var(--text-muted)' }}>
            <Info className="w-3 h-3" style={{ color: 'var(--accent)' }} />
            Closed-Loop Workflow
          </div>
          {[
            { color: '#6366f1', label: 'User → Orchestrator Input' },
            { color: '#10b981', label: 'Active Agent Handshake' },
            { color: '#8b5cf6', label: 'Drafter → Delivery → User' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-[10px] font-mono mb-0.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Inspect hint — shows when nothing is selected */}
        {!inspectedAgent && (
          <div className="absolute bottom-3 right-3 z-10 pointer-events-none hidden md:flex items-center gap-1.5 text-[10px] rounded-lg px-2.5 py-1.5"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <ChevronRight className="w-3 h-3" />
            Click any node to inspect
          </div>
        )}
      </div>

      {/* ── Drawer — absolute overlay OVER the whole panel (not inside the flex row) ── */}
      {inspectedAgent && (
        <AgentDetailDrawer
          agent={inspectedAgent}
          onClose={() => setInspectedAgentId(null)}
        />
      )}
    </div>
  );
};
