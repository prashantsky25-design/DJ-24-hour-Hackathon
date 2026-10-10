import { useState } from 'react';
import { useAresStream } from './hooks/useAresStream';
import { useTheme } from './hooks/useTheme';
import { useResearchEnvironment } from './hooks/useResearchEnvironment';
import { Header } from './components/layout/Header';
import { Sidebar, AppViewTab } from './components/layout/Sidebar';
import { ConnectionModal } from './components/layout/ConnectionModal';
import { EmergencyStopModal } from './components/steering/EmergencyStopModal';
import { OverviewCockpit } from './components/overview/OverviewCockpit';
import { AgentGraphPanel } from './components/graph/AgentGraphPanel';
import { LogsAndReasoningSplit } from './components/terminal/LogsAndReasoningSplit';
import { ResearchWorkspace } from './components/workspace/ResearchWorkspace';
import { ResearchReportViewer } from './components/report/ResearchReportViewer';
import { Terminal, Shield, GitBranch, FileText, Sparkles } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<AppViewTab>('workspace');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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

  return (
    <div
      className="flex h-screen w-screen overflow-hidden font-sans select-text transition-colors"
      style={{
        backgroundColor: 'var(--bg-main)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={selectSession}
        onNewSession={createNewSession}
        onDeleteSession={deleteSession}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        isMobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        theme={theme}
        onToggleTheme={toggleTheme}
        hasReport={Boolean(activeReport)}
      />

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          sessionTitle={activeSession?.title || 'PS3 Research Session'}
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

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          {/* 1. Interactive Research Workspace */}
          {activeTab === 'workspace' && (
            <div className="h-full flex flex-col max-w-5xl mx-auto">
              <ResearchWorkspace
                messages={activeSession.messages}
                onSendMessage={sendResearchQuery}
                isLoading={isProcessing}
                activeStatusMessage={pipelineStepMessage}
                onOpenReportView={() => setActiveTab('report')}
                activeReport={activeReport}
              />
            </div>
          )}

          {/* 2. Dynamic AI Agent Graph with User Node & Report Flow */}
          {activeTab === 'graph' && (
            <div className="max-w-7xl mx-auto space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    Autonomous Multi-Agent Topology Graph
                  </h2>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Closed-loop user connected graph: User Node → Orchestrator → Research Agents → Report Delivery Bus → User
                  </p>
                </div>

                {activeReport && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('report')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white shadow-xs"
                    style={{ backgroundColor: '#10B981' }}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>View Generated Report</span>
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

          {/* 3. Research Report Viewer & PDF Export */}
          {activeTab === 'report' && (
            <div className="max-w-5xl mx-auto space-y-4">
              {activeReport ? (
                <ResearchReportViewer report={activeReport} />
              ) : (
                <div
                  className="rounded-2xl border p-12 text-center max-w-xl mx-auto"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-40 text-indigo-400" />
                  <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                    No Report Generated Yet
                  </h3>
                  <p className="text-xs mb-6" style={{ color: 'var(--text-secondary)' }}>
                    Submit a research question in the Research Workspace to orchestrate the agent cluster and synthesize an academic report.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('workspace')}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    Go to Research Workspace
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 4. Cockpit & Telemetry Overview */}
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

          {/* 5. Terminal & Reasoning Stream */}
          {activeTab === 'terminal' && (
            <div className="max-w-7xl mx-auto h-[650px]">
              <LogsAndReasoningSplit
                logs={logs}
                reasoning={reasoning}
                onClearLogs={clearLogs}
              />
            </div>
          )}
        </main>

        {/* Footer / Telemetry Bar */}
        <footer
          className="w-full border-t px-4 py-2.5 text-[11px] flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 select-none"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
            color: 'var(--text-secondary)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-indigo-500" />
              <span>Closed Loop: <code className="font-mono text-indigo-500">User → Agents → Report</code> [ACTIVE]</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-emerald-500" />
              <span>Citations: <code className="font-mono text-emerald-500">NeurIPS / ArXiv Grounded</code></span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-mono text-[10px]">
              <Terminal className="w-3 h-3" />
              PS3 • 24h Hackathon Research Environment
            </span>
          </div>
        </footer>
      </div>

      {/* Modals */}
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
