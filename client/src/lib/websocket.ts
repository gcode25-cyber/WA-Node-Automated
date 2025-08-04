// Centralized WebSocket connection utility
// This prevents multiple WebSocket connections and ensures proper URL construction

let wsInstance: WebSocket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;

export interface WebSocketMessage {
  type: 'qr' | 'connected' | 'disconnected' | 'logout';
  data?: any;
}

export type WebSocketEventHandler = (message: WebSocketMessage) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private eventHandlers: Set<WebSocketEventHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;

  constructor() {
    this.connect();
  }

  private connect() {
    try {
      // Use explicit port 5000 to match the Express server
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const hostname = window.location.hostname;
      const port = '5000'; // Explicit port matching the Express server
      const wsUrl = `${protocol}//${hostname}:${port}/ws`;
      
      console.log('🔌 WebSocket connecting to:', wsUrl);
      console.log('🔌 Connection details:', {
        protocol,
        hostname,
        port,
        currentLocation: window.location.href
      });

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('📡 WebSocket connected successfully');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('📨 WebSocket message received:', message.type);
          
          // Notify all registered handlers
          this.eventHandlers.forEach(handler => {
            try {
              handler(message);
            } catch (error) {
              console.error('Error in WebSocket event handler:', error);
            }
          });
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('📡 WebSocket disconnected:', event.code, event.reason);
        this.ws = null;
        
        // Attempt to reconnect if we haven't exceeded max attempts
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          
          if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
          }
          
          reconnectTimeout = setTimeout(() => {
            this.connect();
          }, this.reconnectDelay);
        } else {
          console.log('❌ Max reconnection attempts reached');
        }
      };

      this.ws.onerror = (error) => {
        console.error('📡 WebSocket error:', error);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      
      // Retry after delay
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), this.reconnectDelay);
      }
    }
  }

  public addEventHandler(handler: WebSocketEventHandler) {
    this.eventHandlers.add(handler);
  }

  public removeEventHandler(handler: WebSocketEventHandler) {
    this.eventHandlers.delete(handler);
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  public disconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.eventHandlers.clear();
  }
}

// Export singleton instance
export const websocketManager = new WebSocketManager();