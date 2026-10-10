import { useState, useEffect } from 'react';
import { ResearchSession, AttachedDocument, ResearchReport, ResearchMessage } from '../types/research';
import { buildSynthesizedReport } from '../services/researchService';
import { aresApi } from '../services/apiService';
import { classifyQuery, QueryPlan } from '../services/intentRouter';
import { planDurationMs } from './usePipelineSimulator';

const SESSIONS_STORAGE_KEY = 'ps3_research_sessions';
const ACTIVE_SESSION_STORAGE_KEY = 'ps3_active_session_id';

function generateId(prefix = 'sess') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

const INITIAL_REPORT: ResearchReport = {
  id: 'rep-mock-1',
  title: 'Investigation of FlashAttention...',
  generatedAt: new Date().toISOString(),
  query: 'Investigation of FlashAttention, Adaptive Learning Rates...',
  citations: [],
  executiveSummary: 'This is a mock initial report for demonstration.',
  methodology: '',
  findings: [],
  comparisons: [],
  limitations: ''
};

const DEFAULT_SESSIONS: ResearchSession[] = [
  {
    id: 'sess-default-1',
    title: 'FlashAttention & Transformer Optimization',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    query: 'Investigation of FlashAttention, Adaptive Learning Rates, and Multi-Agent Reasoning Handoffs in Transformer Architectures',
    documents: [
      {
        id: 'doc-init-1',
        name: 'attention_is_all_you_need.pdf',
        size: 562000,
        type: 'pdf',
        uploadedAt: new Date(Date.now() - 7200000).toISOString(),
      },
    ],
    report: INITIAL_REPORT,
    status: 'completed',
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Please evaluate FlashAttention vs standard multi-head attention and synthesize empirical findings with academic citations.',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        attachments: [
          {
            id: 'doc-init-1',
            name: 'attention_is_all_you_need.pdf',
            size: 562000,
            type: 'pdf',
            uploadedAt: new Date(Date.now() - 7200000).toISOString(),
          },
        ],
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: `I have orchestrated the dynamic research cluster to investigate your inquiry regarding FlashAttention and multi-agent coordination. The Literature Scout verified the paper corpus, the Hypothesis Engine tested parameter convergence, and the Report Drafter synthesized a complete technical report with 5 peer-reviewed citations.

You can view the structured document and export a publication-ready PDF using the button below or via the "Research Report" tab.`,
        timestamp: new Date(Date.now() - 7100000).toISOString(),
        reportId: INITIAL_REPORT.id,
      },
    ],
  },
];

export function useResearchEnvironment() {
  const [sessions, setSessions] = useState<ResearchSession[]>(() => {
    try {
      const stored = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return DEFAULT_SESSIONS;
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    try {
      const storedId = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
      if (storedId) return storedId;
    } catch {
      // Fallback
    }
    return sessions[0]?.id || 'sess-default-1';
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [pipelineStepMessage, setPipelineStepMessage] = useState<string>('');

  // Persist sessions
  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, activeSessionId);
    } catch {
      // Storage errors ignored
    }
  }, [sessions, activeSessionId]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0] || DEFAULT_SESSIONS[0];

  const createNewSession = () => {
    const newSession: ResearchSession = {
      id: generateId(),
      title: 'New Research Inquiry',
      createdAt: new Date().toISOString(),
      query: '',
      documents: [],
      messages: [],
      status: 'idle',
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const selectSession = (id: string) => {
    setActiveSessionId(id);
  };

  const deleteSession = (id: string) => {
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      if (filtered.length === 0) {
        const fresh: ResearchSession = {
          id: generateId(),
          title: 'New Research Inquiry',
          createdAt: new Date().toISOString(),
          query: '',
          documents: [],
          messages: [],
          status: 'idle',
        };
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (id === activeSessionId) {
        setActiveSessionId(filtered[0].id);
      }
      return filtered;
    });
  };

  const sendResearchQuery = async (
    queryText: string,
    attachedFiles: AttachedDocument[] = [],
    planOverride?: QueryPlan,
  ) => {
    if (!queryText.trim() && attachedFiles.length === 0) return;
    if (isProcessing) return;

    const plan = planOverride ?? classifyQuery(queryText, attachedFiles.length);

    const userMessage: ResearchMessage = {
      id: generateId('msg'),
      role: 'user',
      content: queryText,
      timestamp: new Date().toISOString(),
      attachments: attachedFiles,
    };

    // Update session title if first query
    const sessionTitle = queryText.trim()
      ? queryText.trim().slice(0, 36) + (queryText.trim().length > 36 ? '...' : '')
      : 'Document Analysis Session';

    // Update active session with user message
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            title: s.messages.length === 0 ? sessionTitle : s.title,
            query: queryText,
            documents: [...s.documents, ...attachedFiles],
            messages: [...s.messages, userMessage],
            status: 'orchestrating',
          };
        }
        return s;
      })
    );

    setIsProcessing(true);

    try {
      setPipelineStepMessage(
        plan.intent === 'chat' ? 'Replying directly...' : `Routing as: ${plan.label}...`,
      );

      // Small talk: answer directly — no sub-agents, no report, no backend call.
      if (plan.intent === 'chat') {
        await new Promise(r => setTimeout(r, planDurationMs(plan) + 200));
        const chatMessage: ResearchMessage = {
          id: generateId('msg'),
          role: 'assistant',
          content: plan.reply ?? 'Hi! How can I help with your research?',
          timestamp: new Date().toISOString(),
        };
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? { ...s, messages: [...s.messages, chatMessage], status: 'completed' }
              : s,
          ),
        );
        return;
      }

      // Check connection mode
      const config = aresApi.getConfig();
      
      if (config.mode === 'simulator') {
        // Simulator mode - wait for the planned agents to finish, then use mock data
        await new Promise(r => setTimeout(r, planDurationMs(plan) + 300));
        const generatedReport = await buildSynthesizedReport(queryText, attachedFiles, plan.intent);

        const assistantMessage: ResearchMessage = {
          id: generateId('msg'),
          role: 'assistant',
          content: `Multi-agent pipeline completed (simulator mode): "${queryText}".

The research synthesis is available below.`,
          timestamp: new Date().toISOString(),
          reportId: generatedReport.id,
        };

        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === activeSessionId) {
              return {
                ...s,
                report: generatedReport,
                messages: [...s.messages, assistantMessage],
                status: 'completed',
              };
            }
            return s;
          })
        );
        return;
      }

      // Real backend mode - call orchestrator API
      const result = await aresApi.orchestrate(queryText, attachedFiles[0]?.name);
      const sessionId = result.sessionId;
      
      setPipelineStepMessage(`Session ${sessionId} started. Connecting to live stream...`);
      
      // WebSocket will stream updates via useAresStream hook
      // We poll the status endpoint as a fallback
      let attempts = 0;
      const maxAttempts = 60;  // 5 minutes max
      
      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000));  // Poll every 5s
        
        try {
          const statusResp = await fetch(`http://localhost:8000/api/status/${sessionId}`);
          if (!statusResp.ok) break;
          
          const statusData = await statusResp.json();
          setPipelineStepMessage(
            `${statusData.active_agent} running... (${statusData.current_task_index + 1}/${statusData.task_nodes.length} tasks)`
          );
          
          if (statusData.status === 'completed' || statusData.status === 'stopped') {
            break;
          }
        } catch (pollErr) {
          console.warn('Status poll failed:', pollErr);
        }
        
        attempts++;
      }

      // Generate report (for now still using mock — will be replaced when Drafter is built)
      const generatedReport = await buildSynthesizedReport(queryText, attachedFiles, plan.intent);

      const assistantMessage: ResearchMessage = {
        id: generateId('msg'),
        role: 'assistant',
        content: `Multi-agent pipeline completed for: "${queryText}".

Session ID: ${sessionId}
Agents deployed: ${result.taskNodes?.length || 0}
Status: Completed

The research synthesis is available below.`,
        timestamp: new Date().toISOString(),
        reportId: generatedReport.id,
      };

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              report: generatedReport,
              messages: [...s.messages, assistantMessage],
              status: 'completed',
            };
          }
          return s;
        })
      );
    } catch (error) {
      console.error('Research query failed:', error);
      const errorMessage: ResearchMessage = {
        id: generateId('msg'),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}. Make sure the orchestrator (port 8000) and sandbox (port 8001) are running.`,
        timestamp: new Date().toISOString(),
      };
      
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              messages: [...s.messages, errorMessage],
              status: 'error',
            };
          }
          return s;
        })
      );
    } finally {
      setIsProcessing(false);
      setPipelineStepMessage('');
    }
  };

  return {
    sessions,
    activeSession,
    activeSessionId,
    activeReport: activeSession?.report || null,
    isProcessing,
    pipelineStepMessage,
    createNewSession,
    selectSession,
    deleteSession,
    sendResearchQuery,
  };
}
