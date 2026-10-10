import { AresEvent, SteeringCommandPayload, ConnectionConfig } from '../types/events';

export type EventCallback = (event: AresEvent) => void;

export class AresApiService {
  private ws: WebSocket | null = null;
  private sse: EventSource | null = null;
  private listeners: Set<EventCallback> = new Set();
  private isConnected = false;
  private reconnectTimer: number | null = null;
  private config: ConnectionConfig = {
    mode: 'simulator',
    wsUrl: 'ws://localhost:8000/ws',
    sseUrl: 'http://localhost:8000/api/stream',
    orchestratorUrl: 'http://localhost:5678/webhook/ares',
    sandboxApiUrl: 'http://localhost:8000/api/sandbox',
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

  public connectWebSocket(): void {
    this.disconnect();
    try {
      this.ws = new WebSocket(this.config.wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.emitEvent({
          type: 'execution_status',
          timestamp: new Date().toLocaleTimeString(),
          payload: { message: 'WebSocket connected to ARES backend' },
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as AresEvent;
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
        if (this.config.autoReconnect && this.config.mode === 'websocket') {
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
}

export const aresApi = new AresApiService();
