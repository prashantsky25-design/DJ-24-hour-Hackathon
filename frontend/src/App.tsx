import { useState, useCallback } from 'react';
import { useAresStream } from './hooks/useAresStream';
import { useTheme } from './hooks/useTheme';
import { useResearchEnvironment } from './hooks/useResearchEnvironment';
import { usePipelineSimulator } from './hooks/usePipelineSimulator';
import { Header } from './components/layout/Header';
import { Sidebar, AppViewTab } from './components/layout/Sidebar';
import { ConnectionModal } from './components/layout/ConnectionModal';
import { EmergencyStopModal } from './components/steering/EmergencyStopModal';
import { OverviewCockpit } from './components/overview/OverviewCockpit';
import { AgentGraphPanel } from './components/graph/AgentGraphPanel';
import { LogsAndReasoningSplit } from './components/terminal/LogsAndReasoningSplit';
import { ResearchWorkspace } from './components/workspace/ResearchWorkspace';
import { ResearchReportViewer } from './components/report/ResearchReportViewer';
import { PipelineExecutionModal } from './components/pipeline/PipelineExecutionModal';
import { AttachedDocument } from './types/research';
import { FileText, GitBranch, Zap } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab]           = useState<AppViewTab>('workspace');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [pipelineModalOpen, setPipelineModalOpen] = useState(false);

  const { theme, toggleTheme } = useTheme();

  const {
    sessions,
    activeSession,
    activeSessionId,
    activeReport,
    isProcessing,
    pipelineStepMessage,
    createNewSession,
    selectSession,
    deleteSession,
    sendResearchQuery,
  } = useResearchEnvironment();

  const {
    agents,
    experiment,
    metrics,
    logs,
    reasoning,
    comparisons,
    config,
    isConnected,
    selectedAgentId,
    setSelectedAgentId,
    setAgents,
    setLogs,
    emergencyModalOpen,
    setEmergencyModalOpen,
    connectionModalOpen,
    setConnectionModalOpen,
    triggerEmergencyStop,
    togglePauseResume,
    submitWhatIfPrompt,
    updateConnectionConfig,
    clearLogs,
  } = useAresStream();

  const { start: startSimulator } = usePipelineSimulator(setAgents, setLogs);

  /* Intercept sendResearchQuery to auto-open the pipeline modal */
  const handleSendQuery = useCallback(
    async (queryText: string, attachedFiles: AttachedDocument[]) => {
      setPipelineModalOpen(true);

      // In simulator mode: reset agents to idle, then walk them sequentially
      if (config.mode === 'simulator') {
        setAgents(prev =>
          prev.map(ag =>
            ag.id !== 'arxiv-radar'
              ? { ...ag, status: 'idle', currentTask: 'Waiting for orchestrator dispatch...' }
              : ag
          )
        );
        startSimulator();
      }

      await sendResearchQuery(queryText, attachedFiles);
    },
    [sendResearchQuery, config.mode, setAgents, startSimulator]
  );

  /* When "View Report →" is clicked inside modal */
  const handleModalViewReport = useCallback(() => {
    setPipelineModalOpen(false);
    setActiveTab('report');
  }, []);

  return (
    <div
      className="flex h-screen w-screen overflow-hidden select-text"
      style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }}
    >
      {/* ── Sidebar ───────────────────────────────────── */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={selectSession}
        onNewSession={createNewSession}
        onDeleteSession={deleteSession}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(p => !p)}
        isMobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        theme={theme}
        onToggleTheme={toggleTheme}
        hasReport={Boolean(activeReport)}
      />

      {/* ── Main column ───────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">

        <Header
          sessionTitle={activeSession?.title || 'ARES Research Session'}
          experiment={experiment}
          config={config}
          isConnected={isConnected}
          hasReport={Boolean(activeReport)}
          onOpenReport={() => setActiveTab('report')}
          onOpenEmergencyModal={() => setEmergencyModalOpen(true)}
          onTogglePauseResume={togglePauseResume}
          onOpenConnectionModal={() => setConnectionModalOpen(true)}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto">

          {/* Workspace */}
          {activeTab === 'workspace' && (
            <div className="h-full flex flex-col max-w-3xl mx-auto px-4 py-4">
              <ResearchWorkspace
                messages={activeSession.messages}
                onSendMessage={handleSendQuery}
                isLoading={isProcessing}
                activeStatusMessage={pipelineStepMessage}
                onOpenReportView={() => setActiveTab('report')}
                activeReport={activeReport}
                onOpenPipeline={() => setPipelineModalOpen(true)}
                isProcessing={isProcessing}
              />
            </div>
          )}

          {/* Agent Graph */}
          {activeTab === 'graph' && (
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Agent Topology
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    Live view of the multi-agent research pipeline
                  </p>
                </div>
                {activeReport && (
                  <button
                    onClick={() => setActiveTab('report')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                    style={{ backgroundColor: 'var(--success)' }}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    View Report
                  </button>
                )}
              </div>
              <AgentGraphPanel
                agents={agents}
                onSelectAgent={setSelectedAgentId}
                selectedAgentId={selectedAgentId}
                activeQuery={activeSession.query}
                attachedDocsCount={activeSession.documents.length}
                report={activeReport}
                onOpenReport={() => setActiveTab('report')}
              />
            </div>
          )}

          {/* Report */}
          {activeTab === 'report' && (
            <div className="max-w-4xl mx-auto px-4 py-4">
              {activeReport ? (
                <ResearchReportViewer report={activeReport} />
              ) : (
                <div
                  className="rounded-xl border p-12 text-center max-w-md mx-auto mt-16"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: 'var(--accent)' }} />
                  <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                    No report yet
                  </h3>
                  <p className="text-xs mb-5" style={{ color: 'var(--text-secondary)' }}>
                    Submit a research query from the Workspace tab to generate a full academic report.
                  </p>
                  <button
                    onClick={() => setActiveTab('workspace')}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium text-white"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    Go to Workspace
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Cockpit */}
          {activeTab === 'overview' && (
            <OverviewCockpit
              agents={agents}
              experiment={experiment}
              metrics={metrics}
              logs={logs}
              reasoning={reasoning}
              comparisons={comparisons}
              onSelectAgent={setSelectedAgentId}
              selectedAgentId={selectedAgentId}
              onSubmitWhatIf={submitWhatIfPrompt}
              onClearLogs={clearLogs}
            />
          )}

          {/* Terminal */}
          {activeTab === 'terminal' && (
            <div className="max-w-7xl mx-auto px-4 py-4 h-[calc(100vh-7rem)]">
              <LogsAndReasoningSplit
                logs={logs}
                reasoning={reasoning}
                onClearLogs={clearLogs}
              />
            </div>
          )}
        </main>

        {/* ── Footer ──────────────────────────────────── */}
        <footer
          className="shrink-0 border-t px-4 py-2 flex items-center justify-between"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="flex items-center gap-4 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1.5">
              <GitBranch className="w-3 h-3" style={{ color: 'var(--success)' }} />
              Git-gated execution
            </span>
            <span className="hidden sm:flex items-center gap-1.5">
              <Zap className="w-3 h-3" style={{ color: 'var(--warning)' }} />
              Self-healing sandbox
            </span>
          </div>
          <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
            ARES · DroidFlow · 24h Hackathon
          </span>
        </footer>
      </div>

      {/* ── Pipeline Execution Modal ───────────────── */}
      <PipelineExecutionModal
        isOpen={pipelineModalOpen}
        onClose={handleModalViewReport}
        agents={agents}
        logs={logs}
        query={activeSession?.query ?? ''}
        pipelineStepMessage={pipelineStepMessage}
        isProcessing={isProcessing}
        sessionStatus={activeSession?.status}
      />

      {/* ── Other modals ───────────────────────────── */}
      <EmergencyStopModal
        isOpen={emergencyModalOpen}
        onClose={() => setEmergencyModalOpen(false)}
        onConfirm={triggerEmergencyStop}
      />

      <ConnectionModal
        isOpen={connectionModalOpen}
        onClose={() => setConnectionModalOpen(false)}
        config={config}
        isConnected={isConnected}
        onSave={updateConnectionConfig}
      />
    </div>
  );
}

export default App;
