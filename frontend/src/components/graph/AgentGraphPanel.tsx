import React, { useMemo, useState } from 'react';
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
import { StatusBadge } from '../common/StatusBadge';
import { Network, Filter, RotateCcw, Info, User, FileText } from 'lucide-react';

interface AgentGraphPanelProps {
  agents: AgentNodeData[];
  onSelectAgent?: (agentId: string) => void;
  selectedAgentId?: string | null;
  activeQuery?: string;
  attachedDocsCount?: number;
  report?: ResearchReport | null;
  onOpenReport?: () => void;
}

export const AgentGraphPanel: React.FC<AgentGraphPanelProps> = ({
  agents,
  onSelectAgent,
  selectedAgentId,
  activeQuery,
  attachedDocsCount = 0,
  report,
  onOpenReport,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [inspectedAgentId, setInspectedAgentId] = useState<string | null>(selectedAgentId || null);

  const nodeTypes = useMemo(
    () => ({
      agentNode: CustomAgentNode,
      userNode: UserNode,
      reportNode: ReportDeliveryNode,
    }),
    []
  );

  // Map agents, user node, and report delivery node into structured positions
  const nodes: Node[] = useMemo(() => {
    const graphNodes: Node[] = [];

    // 1. User Node
    graphNodes.push({
      id: 'user-node',
      type: 'userNode',
      position: { x: 380, y: 20 },
      data: {
        label: 'Human Researcher',
        role: 'Client Initiator & Evaluator',
        activeQuery: activeQuery || 'Exploration of Attention Mechanisms and LLM Multi-Agent Coordination',
        attachedDocsCount,
        status: report ? 'reviewing' : activeQuery ? 'active' : 'idle',
      },
      selected: inspectedAgentId === 'user-node',
    });

    // 2. Report Delivery Node
    graphNodes.push({
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

    // 3. Dynamic Specialized Agent Nodes
    const positions: Record<string, { x: number; y: number }> = {
      'orchestrator': { x: 380, y: 180 },
      'paper-reader': { x: 60, y: 340 },
      'dynamic-spawner': { x: 380, y: 340 },
      'arxiv-radar': { x: 60, y: 520 },
      'coding-agent': { x: 380, y: 520 },
      'debugging-agent': { x: 740, y: 340 },
      'sandbox-executor': { x: 740, y: 520 },
      'drafter-agent': { x: 760, y: 180 },
    };

    agents
      .filter((ag) => (filterStatus === 'all' ? true : ag.status === filterStatus))
      .forEach((agent) => {
        graphNodes.push({
          id: agent.id,
          type: 'agentNode',
          position: positions[agent.id] || { x: 200, y: 200 },
          data: agent as unknown as Record<string, unknown>,
          selected: inspectedAgentId === agent.id,
        });
      });

    return graphNodes;
  }, [agents, filterStatus, inspectedAgentId, activeQuery, attachedDocsCount, report, onOpenReport]);

  // Edges defining complete user-connected closed-loop research topology
  const edges: Edge[] = useMemo(() => {
    return [
      // User -> Orchestrator
      {
        id: 'e-user-orch',
        source: 'user-node',
        target: 'orchestrator',
        animated: true,
        style: { stroke: '#6366F1', strokeWidth: 2.5 },
        label: 'Inquire & Uploads',
        labelStyle: { fill: '#818CF8', fontSize: 10, fontFamily: 'monospace', fontWeight: 600 },
        labelBgStyle: { fill: 'var(--surface)', rx: 4, ry: 4 },
      },
      // Orchestrator -> Paper Reader / Literature Scout
      {
        id: 'e-orch-reader',
        source: 'orchestrator',
        target: 'paper-reader',
        animated: true,
        style: { stroke: '#818CF8', strokeWidth: 2 },
        label: 'Parse Context',
        labelStyle: { fill: '#94A3B8', fontSize: 10, fontFamily: 'monospace' },
        labelBgStyle: { fill: 'var(--surface)', rx: 4, ry: 4 },
      },
      // Orchestrator -> Dynamic Spawner
      {
        id: 'e-orch-spawner',
        source: 'orchestrator',
        target: 'dynamic-spawner',
        animated: true,
        style: { stroke: '#818CF8', strokeWidth: 2 },
        label: 'Task Plan',
        labelStyle: { fill: '#94A3B8', fontSize: 10, fontFamily: 'monospace' },
        labelBgStyle: { fill: 'var(--surface)', rx: 4, ry: 4 },
      },
      // Paper Reader -> Dynamic Spawner (Context handoff)
      {
        id: 'e-reader-spawner',
        source: 'paper-reader',
        target: 'dynamic-spawner',
        animated: true,
        style: { stroke: '#06B6D4', strokeWidth: 2 },
        label: 'Extracted Citations',
        labelStyle: { fill: '#06B6D4', fontSize: 10, fontFamily: 'monospace' },
        labelBgStyle: { fill: 'var(--surface)', rx: 4, ry: 4 },
      },
      // Dynamic Spawner -> Coding Agent
      {
        id: 'e-spawner-coder',
        source: 'dynamic-spawner',
        target: 'coding-agent',
        animated: true,
        style: { stroke: '#10B981', strokeWidth: 2 },
        label: 'Synthesize Patch',
        labelStyle: { fill: '#10B981', fontSize: 10, fontFamily: 'monospace' },
        labelBgStyle: { fill: 'var(--surface)', rx: 4, ry: 4 },
      },
      // Coding Agent -> Sandbox Executor
      {
        id: 'e-coder-sandbox',
        source: 'coding-agent',
        target: 'sandbox-executor',
        animated: true,
        style: { stroke: '#38BDF8', strokeWidth: 2 },
        label: 'Benchmark Run',
        labelStyle: { fill: '#38BDF8', fontSize: 10, fontFamily: 'monospace' },
        labelBgStyle: { fill: 'var(--surface)', rx: 4, ry: 4 },
      },
      // Sandbox -> Debugging / Critic Agent
      {
        id: 'e-sandbox-debugger',
        source: 'sandbox-executor',
        target: 'debugging-agent',
        style: { stroke: '#FB7185', strokeDasharray: '4 4', strokeWidth: 2 },
        label: 'Rigor Audit',
        labelStyle: { fill: '#FDA4AF', fontSize: 10, fontFamily: 'monospace' },
        labelBgStyle: { fill: 'var(--surface)', rx: 4, ry: 4 },
      },
      // Critic -> Drafter Agent
      {
        id: 'e-debugger-drafter',
        source: 'debugging-agent',
        target: 'drafter-agent',
        animated: true,
        style: { stroke: '#A78BFA', strokeWidth: 2 },
        label: 'Audit Approved',
        labelStyle: { fill: '#C4B5FD', fontSize: 10, fontFamily: 'monospace' },
        labelBgStyle: { fill: 'var(--surface)', rx: 4, ry: 4 },
      },
      // Drafter Agent -> Report Delivery Node
      {
        id: 'e-drafter-report',
        source: 'drafter-agent',
        target: 'report-delivery-node',
        animated: true,
        style: { stroke: '#10B981', strokeWidth: 2.5 },
        label: 'Deliver Report',
        labelStyle: { fill: '#10B981', fontSize: 10, fontFamily: 'monospace', fontWeight: 600 },
        labelBgStyle: { fill: 'var(--surface)', rx: 4, ry: 4 },
      },
      // Report Delivery Node -> User Node (Closing the loop!)
      {
        id: 'e-report-user',
        source: 'report-delivery-node',
        target: 'user-node',
        animated: Boolean(report),
        style: { stroke: '#10B981', strokeWidth: 2.5, strokeDasharray: report ? undefined : '5 5' },
        label: 'Deliver to User',
        labelStyle: { fill: '#10B981', fontSize: 10, fontFamily: 'monospace', fontWeight: 600 },
        labelBgStyle: { fill: 'var(--surface)', rx: 4, ry: 4 },
      },
    ];
  }, [report]);

  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    if (node.id === 'report-delivery-node' && onOpenReport) {
      onOpenReport();
      return;
    }
    setInspectedAgentId(node.id);
    if (onSelectAgent) {
      onSelectAgent(node.id);
    }
  };

  const inspectedAgent = agents.find((a) => a.id === inspectedAgentId) || null;

  const counts = useMemo(() => {
    return {
      all: agents.length,
      running: agents.filter((a) => a.status === 'running').length,
      spawning: agents.filter((a) => a.status === 'spawning').length,
      idle: agents.filter((a) => a.status === 'idle').length,
      retired: agents.filter((a) => a.status === 'retired').length,
    };
  }, [agents]);

  return (
    <div
      className="relative w-full h-[640px] rounded-2xl border overflow-hidden shadow-xl flex flex-col transition-colors"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Top Graph Control Bar */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b z-10 select-none backdrop-blur-xs"
        style={{
          backgroundColor: 'var(--surface-secondary)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-indigo-500" />
          <h3 className="text-xs font-bold tracking-tight uppercase" style={{ color: 'var(--text-primary)' }}>
            Evolving AI Agent Graph
          </h3>
          <span className="text-[11px] font-mono hidden sm:inline" style={{ color: 'var(--text-secondary)' }}>
            (User-Connected Closed-Loop Architecture)
          </span>
        </div>

        {/* State Filter Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 text-[11px] mr-1" style={{ color: 'var(--text-secondary)' }}>
            <Filter className="w-3 h-3" />
            <span>Filter:</span>
          </div>
          {(['all', 'running', 'spawning', 'idle', 'retired'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all border ${
                filterStatus === st
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'hover:opacity-100 opacity-70'
              }`}
              style={{
                backgroundColor: filterStatus === st ? 'var(--accent)' : 'var(--surface)',
                borderColor: filterStatus === st ? 'var(--accent)' : 'var(--border)',
                color: filterStatus === st ? '#FFFFFF' : 'var(--text-primary)',
              }}
            >
              {st} ({counts[st as keyof typeof counts]})
            </button>
          ))}
          {filterStatus !== 'all' && (
            <button
              onClick={() => setFilterStatus('all')}
              className="p-1 rounded-lg hover:opacity-100 opacity-60 transition-opacity"
              style={{ color: 'var(--text-secondary)' }}
              title="Reset filter"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 w-full h-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.4}
          maxZoom={1.6}
          style={{ backgroundColor: 'var(--graph-bg)' }}
        >
          <Background
            color="var(--graph-grid)"
            gap={24}
            size={1.5}
            variant={BackgroundVariant.Dots}
          />
          <Controls
            className="!border !rounded-xl !shadow-lg"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
            }}
          />
          <MiniMap
            className="!border !rounded-xl"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
            }}
            nodeColor={(n) => {
              if (n.id === 'user-node') return '#6366F1';
              if (n.id === 'report-delivery-node') return '#10B981';
              const d = n.data as unknown as AgentNodeData;
              if (d?.status === 'running') return '#10B981';
              if (d?.status === 'spawning') return '#F59E0B';
              if (d?.status === 'retired') return '#8B5CF6';
              return '#64748B';
            }}
          />
        </ReactFlow>

        {/* Floating User & Report Loop Legend */}
        <div
          className="absolute bottom-4 left-4 z-10 p-3 rounded-xl border shadow-xl backdrop-blur-xs text-xs space-y-1.5 hidden md:block"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
            <Info className="w-3 h-3 text-indigo-500" />
            <span>Closed-Loop Workflow</span>
          </div>
          <div className="space-y-1 text-[11px] font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <span>User Node → Orchestrator Input</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Active Agent Task Handshake</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span>Report Drafter → Delivery → User</span>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Agent Inspector Drawer */}
      <AgentDetailDrawer
        agent={inspectedAgent}
        onClose={() => setInspectedAgentId(null)}
      />
    </div>
  );
};
