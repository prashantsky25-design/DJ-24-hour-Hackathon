import { useState, useEffect, useCallback, useRef } from 'react';
import { AgentNodeData } from '../types/agent';
import { TerminalLogEntry, ReasoningStep } from '../types/log';
import { MetricPoint, ExperimentMetadata, MetricComparisonSummary } from '../types/metric';
import { AresEvent, ConnectionConfig, SteeringCommandPayload } from '../types/events';
import {
  INITIAL_AGENTS,
  INITIAL_EXPERIMENT,
  INITIAL_METRICS,
  INITIAL_LOGS,
  INITIAL_REASONING,
  COMPARISON_SUMMARIES,
  BASELINE_TRAIN_PY,
  EXPERIMENT_TRAIN_PY,
} from '../services/mockSimulator';
import { aresApi } from '../services/apiService';

export function useAresStream() {
  const [agents, setAgents] = useState<AgentNodeData[]>(INITIAL_AGENTS);
  const [experiment, setExperiment] = useState<ExperimentMetadata>(INITIAL_EXPERIMENT);
  const [metrics, setMetrics] = useState<MetricPoint[]>(INITIAL_METRICS);
  const [logs, setLogs] = useState<TerminalLogEntry[]>(INITIAL_LOGS);
  const [reasoning, setReasoning] = useState<ReasoningStep[]>(INITIAL_REASONING);
  const [comparisons, setComparisons] = useState<MetricComparisonSummary[]>(COMPARISON_SUMMARIES);
  const [config, setConfig] = useState<ConnectionConfig>(aresApi.getConfig());
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);

  const baselineCode = useRef(BASELINE_TRAIN_PY);
  const experimentCode = useRef(EXPERIMENT_TRAIN_PY);

  // Handle incoming events (from WS, SSE, or local simulator)
  const handleEvent = useCallback((event: AresEvent) => {
    switch (event.type) {
      case 'agent_state_changed': {
        const payload = event.payload as {
          agentId: string;
          status: AgentNodeData['status'];
          currentTask?: string;
          tokensUsed?: number;
          runtimeSec?: number;
          toolCallsCount?: number;
        };
        setAgents((prev) =>
          prev.map((ag) => {
            if (ag.id === payload.agentId) {
              return {
                ...ag,
                status: payload.status,
                currentTask: payload.currentTask ?? ag.currentTask,
                tokensUsed: payload.tokensUsed ?? ag.tokensUsed,
                runtimeSec: payload.runtimeSec ?? ag.runtimeSec,
                toolCallsCount: payload.toolCallsCount ?? ag.toolCallsCount,
                lastActive: 'Just now',
              };
            }
            return ag;
          })
        );
        break;
      }

      case 'log_chunk': {
        const payload = event.payload as TerminalLogEntry;
        setLogs((prev) => [...prev.slice(-300), { ...payload, id: payload.id || String(Date.now() + Math.random()) }]);
        break;
      }

      case 'reasoning_step': {
        const payload = event.payload as ReasoningStep;
        setReasoning((prev) => [payload, ...prev]);
        break;
      }

      case 'metric_point': {
        const payload = event.payload as MetricPoint;
        setMetrics((prev) => [...prev, payload]);
        setExperiment((prev) => ({
          ...prev,
          currentEpoch: payload.epoch,
        }));
        break;
      }

      case 'execution_status': {
        const payload = event.payload as { status?: ExperimentMetadata['status']; message?: string };
        if (payload.status) {
          setExperiment((prev) => ({ ...prev, status: payload.status! }));
        }
        if (payload.message) {
          setLogs((prev) => [
            ...prev,
            {
              id: String(Date.now()),
              timestamp: new Date().toLocaleTimeString(),
              source: 'system',
              level: 'info',
              message: payload.message!,
            },
          ]);
        }
        break;
      }

      default:
        break;
    }
  }, []);

  // Subscribe to apiService
  useEffect(() => {
    const unsubscribe = aresApi.subscribe(handleEvent);
    return () => {
      unsubscribe();
    };
  }, [handleEvent]);

  // Simulation background ticker when mode is 'simulator' and experiment is running
  useEffect(() => {
    if (config.mode !== 'simulator' || experiment.status !== 'running') {
      return;
    }

    const interval = setInterval(() => {
      setExperiment((prev) => {
        if (prev.status !== 'running') return prev;

        const nextEpoch = prev.currentEpoch < prev.totalEpochs ? prev.currentEpoch + 1 : prev.totalEpochs;

        // Stop simulation when training completes
        if (nextEpoch >= prev.totalEpochs) {
          setTimeout(() => {
            setExperiment(p => ({ ...p, status: 'completed' }));
            // Add completion log
            setLogs(l => [...l, {
              id: String(Date.now()),
              timestamp: new Date().toLocaleTimeString(),
              source: 'system',
              level: 'info',
              message: '✓ Training complete! Final metrics: Val Loss=0.195 | Accuracy=94.3%',
            }]);
          }, 1000);
          return prev;
        }

        // Add a simulated metric point if epoch progressed
        if (nextEpoch > prev.currentEpoch) {
          const lastMetric = metrics[metrics.length - 1];
          const newExpLoss = Math.max(0.18, (lastMetric?.experimentValLoss || 0.5) - 0.025);
          const newExpTrainLoss = Math.max(0.12, (lastMetric?.experimentTrainLoss || 0.3) - 0.02);
          const newAcc = Math.min(94.5, (lastMetric?.experimentAccuracy || 90.9) + 0.4);

          const newPoint: MetricPoint = {
            epoch: nextEpoch,
            step: nextEpoch * 100,
            baselineTrainLoss: Math.max(0.65, 0.73 - nextEpoch * 0.005),
            baselineValLoss: Math.max(0.98, 1.09 - nextEpoch * 0.004),
            experimentTrainLoss: Number(newExpTrainLoss.toFixed(3)),
            experimentValLoss: Number(newExpLoss.toFixed(3)),
            baselineAccuracy: 83.2,
            experimentAccuracy: Number(newAcc.toFixed(1)),
            learningRate: Number((0.0001 * Math.exp(-0.08 * nextEpoch)).toFixed(6)),
            timestamp: new Date().toLocaleTimeString(),
          };

          setMetrics((m) => [...m, newPoint]);

          // Append simulated log line
          const logLines: TerminalLogEntry[] = [
            {
              id: String(Date.now()),
              timestamp: new Date().toLocaleTimeString(),
              source: 'stdout',
              level: 'info',
              message: `Epoch ${String(nextEpoch).padStart(2, '0')}/${prev.totalEpochs} | Train: ${newExpTrainLoss.toFixed(3)} | Val: ${newExpLoss.toFixed(3)} | Acc: ${newAcc.toFixed(1)}% | 806 smp/s | 12.8s`,
            },
          ];
          setLogs((l) => [...l.slice(-250), ...logLines]);

          // Update comparison delta
          setComparisons((comps) =>
            comps.map((c) => {
              if (c.metricName === 'Validation Loss') {
                return {
                  ...c,
                  experimentValue: Number(newExpLoss.toFixed(3)),
                  deltaPercent: Number((((newExpLoss - c.baselineValue) / c.baselineValue) * 100).toFixed(1)),
                };
              }
              if (c.metricName === 'Top-1 Accuracy') {
                return {
                  ...c,
                  experimentValue: Number(newAcc.toFixed(1)),
                  deltaPercent: Number((((newAcc - c.baselineValue) / c.baselineValue) * 100).toFixed(1)),
                };
              }
              return c;
            })
          );
        }

        return {
          ...prev,
          currentEpoch: nextEpoch,
          gpuMemoryUsageMb: Math.floor(8600 + Math.random() * 300),
        };
      });

      // Subtle active task jitter for visual feedback
      setAgents((prevAgents) =>
        prevAgents.map((ag) => {
          if (ag.id === 'sandbox-executor') {
            return {
              ...ag,
              runtimeSec: ag.runtimeSec + 5,
              currentTask: `Executing PyTorch training on A100 GPU (E2B sandbox)`,
            };
          }
          if (ag.id === 'orchestrator') {
            return {
              ...ag,
              tokensUsed: ag.tokensUsed + 120,
              runtimeSec: ag.runtimeSec + 5,
            };
          }
          return ag;
        })
      );
    }, 3000);  // 3 seconds per epoch (30 epochs = 90 seconds total training)

    return () => clearInterval(interval);
  }, [config.mode, experiment.status, metrics]);

  // Steering Controls
  const triggerEmergencyStop = async () => {
    setEmergencyModalOpen(false);
    setExperiment((prev) => ({ ...prev, status: 'halted' }));
    setAgents((prev) =>
      prev.map((ag) => ({
        ...ag,
        status: ag.id === 'sandbox-executor' ? 'error' : 'retired',
        currentTask: 'EMERGENCY HALT: Execution interrupted by human researcher',
      }))
    );
    const haltLog: TerminalLogEntry = {
      id: String(Date.now()),
      timestamp: new Date().toLocaleTimeString(),
      source: 'system',
      level: 'error',
      message: '🚨 EMERGENCY STOP TRIGGERED BY USER. SIGKILL dispatched to E2B sandbox. Agents halted.',
    };
    setLogs((prev) => [...prev, haltLog]);

    await aresApi.sendSteeringCommand({ action: 'emergency_stop' });
  };

  const togglePauseResume = async () => {
    const newStatus = experiment.status === 'running' ? 'paused' : 'running';
    setExperiment((prev) => ({ ...prev, status: newStatus }));

    setAgents((prev) =>
      prev.map((ag) => {
        if (ag.id === 'sandbox-executor') {
          return {
            ...ag,
            status: newStatus === 'running' ? 'running' : 'idle',
            currentTask: newStatus === 'running' ? 'Resumed PyTorch training' : 'PAUSED by researcher',
          };
        }
        return ag;
      })
    );

    const log: TerminalLogEntry = {
      id: String(Date.now()),
      timestamp: new Date().toLocaleTimeString(),
      source: 'system',
      level: 'warn',
      message: newStatus === 'paused' ? '⏸️ Execution PAUSED by human steering control.' : '▶️ Execution RESUMED.',
    };
    setLogs((prev) => [...prev, log]);

    await aresApi.sendSteeringCommand({ action: newStatus === 'running' ? 'resume' : 'pause' });
  };

  const submitWhatIfPrompt = async (promptText: string) => {
    if (!promptText.trim()) return;

    // Log the user's steering intervention
    const userLog: TerminalLogEntry = {
      id: String(Date.now()),
      timestamp: new Date().toLocaleTimeString(),
      source: 'agent',
      level: 'info',
      message: `[Human Steering] What-If Prompt received: "${promptText}"`,
    };
    setLogs((prev) => [...prev, userLog]);

    // Activate Dynamic Spawner and Coding Agent
    setAgents((prev) =>
      prev.map((ag) => {
        if (ag.id === 'dynamic-spawner') {
          return {
            ...ag,
            status: 'running',
            currentTask: `Decomposing hypothesis: "${promptText.slice(0, 48)}..."`,
            lastActive: 'Just now',
          };
        }
        if (ag.id === 'coding-agent') {
          return {
            ...ag,
            status: 'spawning',
            currentTask: `Synthesizing modifications for train.py based on user steering...`,
            lastActive: 'Just now',
          };
        }
        return ag;
      })
    );

    // Create a new reasoning step for this hypothesis
    const newReasoning: ReasoningStep = {
      id: `r-whatif-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      agentId: 'orchestrator',
      agentName: 'Dynamic Spawner & Orchestrator',
      hypothesis: promptText,
      thought: `Human researcher injected a What-If steering prompt. Re-evaluating hyperparameter search space and verifying backward compatibility with prepare.py.`,
      action: {
        tool: 'evaluate_what_if_hypothesis',
        params: { prompt: promptText, sandboxCommit: experiment.gitCommitHash },
      },
      observation: `Hypothesis accepted. Safe execution boundary confirmed. Provisioning sub-agent task.`,
      decision: `Dispatching patch proposal to Coding Agent for trial in next iteration.`,
      status: 'in_progress',
    };
    setReasoning((prev) => [newReasoning, ...prev]);

    // Dispatch to API
    await aresApi.sendSteeringCommand({
      action: 'what_if_prompt',
      prompt: promptText,
    });
  };

  const rollbackCommit = async () => {
    const rollbackLog: TerminalLogEntry = {
      id: String(Date.now()),
      timestamp: new Date().toLocaleTimeString(),
      source: 'system',
      level: 'warn',
      message: 'Git-Gated Rollback: Executed "git reset --hard a7f3b89e". Restored train.py to safe checkpoint.',
    };
    setLogs((prev) => [...prev, rollbackLog]);

    setAgents((prev) =>
      prev.map((ag) =>
        ag.id === 'debugging-agent'
          ? { ...ag, status: 'running', currentTask: 'Verifying clean sandbox state after git reset' }
          : ag
      )
    );

    await aresApi.sendSteeringCommand({ action: 'git_rollback', targetCommit: 'a7f3b89e' });
  };

  const updateConnectionConfig = (newConfig: Partial<ConnectionConfig>) => {
    aresApi.updateConfig(newConfig);
    setConfig(aresApi.getConfig());
    setIsConnected(aresApi.getStatus());
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return {
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
    baselineCode: baselineCode.current,
    experimentCode: experimentCode.current,
    triggerEmergencyStop,
    togglePauseResume,
    submitWhatIfPrompt,
    rollbackCommit,
    updateConnectionConfig,
    clearLogs,
  };
}
