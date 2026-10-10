import React, { useState, useEffect } from 'react';
import { ConnectionConfig } from '../../types/events';
import { X, Network, CheckCircle2, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { aresApi } from '../../services/apiService';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ConnectionConfig;
  isConnected: boolean;
  onSave: (config: Partial<ConnectionConfig>) => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  config,
  isConnected,
  onSave,
}) => {
  const [mode, setMode] = useState<ConnectionConfig['mode']>(config.mode);
  const [wsUrl, setWsUrl] = useState(config.wsUrl);
  const [sseUrl, setSseUrl] = useState(config.sseUrl);
  const [orchestratorUrl, setOrchestratorUrl] = useState(config.orchestratorUrl);
  const [sandboxApiUrl, setSandboxApiUrl] = useState(config.sandboxApiUrl);
  const [autoReconnect, setAutoReconnect] = useState(config.autoReconnect);
  const [healthStatus, setHealthStatus] = useState<{ orchestrator: boolean; sandbox: boolean } | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  // Check backend health when modal opens
  useEffect(() => {
    if (isOpen && mode !== 'simulator') {
      checkBackendHealth();
    }
  }, [isOpen, mode]);

  const checkBackendHealth = async () => {
    setCheckingHealth(true);
    try {
      const status = await aresApi.checkHealth();
      setHealthStatus(status);
    } catch (err) {
      console.error('Health check failed:', err);
      setHealthStatus({ orchestrator: false, sandbox: false });
    } finally {
      setCheckingHealth(false);
    }
  };

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      mode,
      wsUrl,
      sseUrl,
      orchestratorUrl,
      sandboxApiUrl,
      autoReconnect,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#0f131a] border border-slate-800 p-6 shadow-2xl text-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">API Connection Settings</h2>
              <p className="text-xs text-slate-400">Configure Member 1 (n8n) & Member 2 (E2B Sandbox) contracts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4 text-sm">
          {/* Connection Mode Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Streaming Protocol
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'simulator', label: 'Local Simulator', desc: 'Demo engine' },
                  { id: 'websocket', label: 'WebSocket (WS)', desc: 'Full-duplex stream' },
                  { id: 'sse', label: 'Server-Sent Events', desc: 'SSE stream' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    mode === item.id
                      ? 'border-indigo-500 bg-indigo-950/40 text-white'
                      : 'border-slate-800 bg-[#151a23] text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold text-xs text-slate-200">{item.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* URLs */}
          {mode === 'websocket' && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                WebSocket Stream URL (Member 2 API)
              </label>
              <input
                type="text"
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#151a23] border border-slate-700 text-white font-mono text-xs focus:outline-hidden focus:border-indigo-500"
                placeholder="ws://localhost:8000/ws"
              />
            </div>
          )}

          {mode === 'sse' && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Server-Sent Events Stream URL (Member 1 / 2)
              </label>
              <input
                type="text"
                value={sseUrl}
                onChange={(e) => setSseUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#151a23] border border-slate-700 text-white font-mono text-xs focus:outline-hidden focus:border-indigo-500"
                placeholder="http://localhost:8000/api/stream"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Member 1 Orchestrator Webhook (n8n trigger)
            </label>
            <input
              type="text"
              value={orchestratorUrl}
              onChange={(e) => setOrchestratorUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#151a23] border border-slate-700 text-white font-mono text-xs focus:outline-hidden focus:border-indigo-500"
              placeholder="http://localhost:5678/webhook/ares"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Member 2 Sandbox Control Endpoint (E2B halt / pause)
            </label>
            <input
              type="text"
              value={sandboxApiUrl}
              onChange={(e) => setSandboxApiUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#151a23] border border-slate-700 text-white font-mono text-xs focus:outline-hidden focus:border-indigo-500"
              placeholder="http://localhost:8000/api/sandbox"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="autoreconnect"
              checked={autoReconnect}
              onChange={(e) => setAutoReconnect(e.target.checked)}
              className="rounded-sm border-slate-700 bg-[#151a23] text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="autoreconnect" className="text-xs text-slate-400">
              Automatic reconnection with exponential backoff
            </label>
          </div>

          {/* Status banner */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {checkingHealth ? (
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                ) : mode === 'simulator' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : healthStatus && (healthStatus.orchestrator || healthStatus.sandbox) ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                )}
                <span className="text-slate-300">
                  {mode === 'simulator'
                    ? 'Local Simulator Active (Zero backend setup needed)'
                    : checkingHealth
                    ? 'Checking backend services...'
                    : healthStatus && (healthStatus.orchestrator || healthStatus.sandbox)
                    ? 'Backend services detected'
                    : 'Backend not detected - using local fallback'}
                </span>
              </div>
              {mode !== 'simulator' && !checkingHealth && (
                <button
                  onClick={checkBackendHealth}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-mono flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  recheck
                </button>
              )}
            </div>

            {/* Backend health details */}
            {mode !== 'simulator' && healthStatus && (
              <div className="flex gap-4 text-[10px] font-mono pl-6">
                <span className={healthStatus.orchestrator ? 'text-emerald-400' : 'text-red-400'}>
                  {healthStatus.orchestrator ? '✓' : '✗'} Orchestrator :8000
                </span>
                <span className={healthStatus.sandbox ? 'text-emerald-400' : 'text-red-400'}>
                  {healthStatus.sandbox ? '✓' : '✗'} Sandbox :8001
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
};
