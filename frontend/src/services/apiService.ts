import { AresEvent, SteeringCommandPayload, ConnectionConfig } from '../types/events';

export type EventCallback = (event: AresEvent) => void;

export class AresApiService {
  private ws: WebSocket | null = null;
  private sse: EventSource | null = null;
  private listeners: Set<EventCallback> = new Set();
  private isConnected = false;
  private reconnectTimer: number | null = null;
  private sessionId: string | null = null;
  private config: ConnectionConfig = {
    mode: 'websocket',  // Default to real backend
    wsUrl: 'ws://localhost:8000/ws',
    sseUrl: 'http://localhost:8000/api/stream',
    orchestratorUrl: 'http://localhost:8000/api/orchestrate',
    sandboxApiUrl: 'http://localhost:8001/api/sandbox',
    autoReconnect: true,
  };

  constructor(customConfig?: Partial<ConnectionConfig>) {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }
  }

  public subscribe(callback: EventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  public emitEvent(event: AresEvent): void {
    this.listeners.forEach((callback) => {
      try {
        callback(event);
      } catch (err) {
        console.error('Error in event listener callback:', err);
      }
    });
  }

  public getConfig(): ConnectionConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<ConnectionConfig>): void {
    const modeChanged = newConfig.mode && newConfig.mode !== this.config.mode;
    this.config = { ...this.config, ...newConfig };
    if (modeChanged) {
      this.disconnect();
      if (this.config.mode === 'websocket') {
        this.connectWebSocket();
      } else if (this.config.mode === 'sse') {
        this.connectSSE();
      }
    }
  }

  public connect(): void {
    if (this.config.mode === 'websocket') {
      this.connectWebSocket();
    } else if (this.config.mode === 'sse') {
      this.connectSSE();
    }
  }

  public setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
    // Auto-connect WebSocket when session ID is set
    if (this.config.mode === 'websocket' && sessionId) {
      this.connectWebSocket();
    }
  }

  public connectWebSocket(): void {
    this.disconnect();
    
    // Need session ID for backend /ws/{session_id} route
    if (!this.sessionId) {
      console.warn('⚠️  Cannot connect WebSocket: session ID not set. Will connect after orchestrate() call.');
      return;
    }

    try {
      const wsUrl = `${this.config.wsUrl}/${this.sessionId}`;
      console.log(`🔌 Connecting WebSocket to ${wsUrl}...`);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log(`✓ WebSocket connected to ${wsUrl}`);
        this.emitEvent({
          type: 'execution_status',
          timestamp: new Date().toLocaleTimeString(),
          payload: { message: 'WebSocket connected to ARES backend' },
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as AresEvent;
          console.log('📥 WebSocket message:', parsed.type);
          this.emitEvent(parsed);
        } catch (err) {
          console.warn('Failed to parse WebSocket message JSON:', err, event.data);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket connection error:', err);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        console.log('WebSocket disconnected');
        if (this.config.autoReconnect && this.config.mode === 'websocket' && this.sessionId) {
          this.scheduleReconnect();
        }
      };
    } catch (err) {
      console.warn('Unable to initiate WebSocket connection:', err);
    }
  }

  public connectSSE(): void {
    this.disconnect();
    try {
      this.sse = new EventSource(this.config.sseUrl);

      this.sse.onopen = () => {
        this.isConnected = true;
        this.emitEvent({
          type: 'execution_status',
          timestamp: new Date().toLocaleTimeString(),
          payload: { message: 'SSE stream connected to ARES backend' },
        });
      };

      this.sse.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as AresEvent;
          this.emitEvent(parsed);
        } catch (err) {
          console.warn('Failed to parse SSE payload:', err, event.data);
        }
      };

      this.sse.onerror = (err) => {
        console.warn('SSE connection error:', err);
        this.isConnected = false;
      };
    } catch (err) {
      console.warn('Unable to initiate SSE connection:', err);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.config.mode === 'websocket') {
        this.connectWebSocket();
      }
    }, 4000);
  }

  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.sse) {
      this.sse.close();
      this.sse = null;
    }
    this.isConnected = false;
  }

  public async sendSteeringCommand(command: SteeringCommandPayload): Promise<{ success: boolean; message: string }> {
    // If connected via WebSocket, send through WS frame
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'steering_command', payload: command }));
      return { success: true, message: 'Steering command transmitted via WebSocket' };
    }

    // Otherwise send via HTTP POST to Member 1 Orchestrator / Member 2 Sandbox
    try {
      const targetUrl = command.action === 'emergency_stop' || command.action === 'pause' || command.action === 'resume'
        ? `${this.config.sandboxApiUrl}/control`
        : `${this.config.orchestratorUrl}`;

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
      });

      if (res.ok) {
        return { success: true, message: 'Command dispatched successfully' };
      }
      return { success: false, message: `Server returned status ${res.status}` };
    } catch (err) {
      // Return gracefully with local fallback notification
      return {
        success: true,
        message: `Command handled locally (${command.action}): ${err instanceof Error ? err.message : 'local mode'}`,
      };
    }
  }

  public getStatus(): boolean {
    return this.isConnected;
  }

  public getSessionId(): string | null {
    return this.sessionId;
  }

  public async escapeSession(sessionId?: string): Promise<boolean> {
    const sid = sessionId || this.sessionId;
    if (!sid) return false;
    try {
      const url = `http://localhost:8000/api/session/${sid}/escape`;
      const res = await fetch(url, { method: 'POST' });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Send research query to orchestrator and get session ID
   */
  public async orchestrate(researchBrief: string, paperUrl?: string): Promise<{ sessionId: string; taskNodes: any[] }> {
    console.log('📤 Sending orchestrate request to', this.config.orchestratorUrl);
    
    try {
      const res = await fetch(this.config.orchestratorUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          research_brief: researchBrief,
          paper_url: paperUrl || null,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`❌ Orchestrator returned ${res.status}:`, errorText);
        throw new Error(`Orchestrator returned ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      console.log('✅ Orchestrate success. Session ID:', data.session_id);
      
      // Store session ID and connect WebSocket
      this.sessionId = data.session_id;
      if (this.config.mode === 'websocket') {
        this.connectWebSocket();
      }

      return {
        sessionId: data.session_id,
        taskNodes: data.task_nodes || [],
      };
    } catch (err) {
      console.error('❌ Orchestrate failed:', err);
      throw err;
    }
  }

  /**
   * Check backend health status
   */
  public async checkHealth(): Promise<{ orchestrator: boolean; sandbox: boolean }> {
    const results = { orchestrator: false, sandbox: false };

    try {
      const orchResp = await fetch(`${this.config.orchestratorUrl.replace('/api/orchestrate', '')}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      results.orchestrator = orchResp.ok;
    } catch {
      // Orchestrator unreachable
    }

    try {
      const sandboxResp = await fetch(`${this.config.sandboxApiUrl.replace('/api/sandbox', '')}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      results.sandbox = sandboxResp.ok;
    } catch {
      // Sandbox unreachable
    }

    return results;
  }
}

export const aresApi = new AresApiService();
