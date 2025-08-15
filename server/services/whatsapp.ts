import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;

// Log import status to verify correct loading
console.log('🔍 WhatsApp imports:', {
  Client: typeof Client,
  LocalAuth: typeof LocalAuth,
  MessageMedia: typeof MessageMedia,
  fromFilePath: typeof MessageMedia?.fromFilePath
});
import QRCode from 'qrcode';
import qrImage from 'qr-image';
import { storage } from '../storage';
import fs from 'fs';
import path from 'path';
import type { WebSocket } from 'ws';

export class WhatsAppService {
  private client: any = null;
  private qrCode: string | null = null;
  private sessionInfo: any = null;
  private isReady: boolean = false;
  private isInitializing: boolean = false;
  private messageCache: Map<string, any[]> = new Map(); // Cache for real-time messages
  private connectionCheckInterval: NodeJS.Timeout | null = null;
  private currentState: string = 'DISCONNECTED';
  private isPhoneConnected: boolean = false;
  private lastStateCheck: Date = new Date();

  constructor() {
    this.initializeClient();
    this.startConnectionMonitoring();
  }

  // Helper method to broadcast WebSocket events
  private broadcastToClients(eventType: string, data: any) {
    try {
      const wss = (global as any).wss;
      if (wss && wss.clients) {
        const message = JSON.stringify({ type: eventType, data });
        wss.clients.forEach((client: any) => {
          if (client.readyState === 1) { // WebSocket.OPEN
            client.send(message);
          }
        });
        console.log(`📡 Broadcasted ${eventType} to ${wss.clients.size} clients`);
      }
    } catch (error) {
      console.error('Failed to broadcast WebSocket message:', error);
    }
  }

  private async initializeClient() {
    if (this.isInitializing) {
      console.log('⚠️ Client already initializing, waiting for completion...');
      // Wait for current initialization to complete or timeout
      let attempts = 0;
      while (this.isInitializing && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      
      if (this.isInitializing) {
        console.log('🔄 Force resetting initialization flag after timeout');
        this.isInitializing = false;
      }
    }
    
    // Additional safety check for existing client
    if (this.client) {
      try {
        await this.client.destroy();
        console.log('🧹 Destroyed existing client before reinitializing');
      } catch (e: any) {
        console.log('Previous client cleanup:', e.message);
      }
      this.client = null;
    }

    try {
      this.isInitializing = true;
      console.log('🚀 Initializing WhatsApp client...');

      // Check if there's an existing session
      const fs = await import('fs');
      const path = await import('path');
      const sessionPath = path.resolve('./.wwebjs_auth');
      const hasExistingSession = fs.existsSync(sessionPath);
      
      // Also check for stored session info in database
      let storedSessionInfo = null;
      try {
        const activeSessions = await storage.getActiveSessions();
        if (activeSessions.length > 0) {
          storedSessionInfo = activeSessions[0];
          console.log('📦 Found stored session info:', storedSessionInfo.userId);
        }
      } catch (error: any) {
        console.log('Session info retrieval failed:', error.message);
      }
      
      if (hasExistingSession) {
        console.log('🔍 Found existing session files, attempting automatic restoration...');
        
        // If we have stored session info, use it for immediate UI updates
        if (storedSessionInfo) {
          console.log('📦 Restoring from stored session info for UI');
          this.sessionInfo = {
            number: storedSessionInfo.userId,
            name: storedSessionInfo.userName,
            loginTime: storedSessionInfo.loginTime
          };
        } else {
          console.log('📋 Session files exist, will restore on WhatsApp ready event');
        }
        
        // Don't mark as ready until client is actually connected and ready
        this.isReady = false;
      } else {
        console.log('📱 No existing session found, will require QR authentication');
      }

      // Clean up existing client
      if (this.client) {
        try {
          await this.client.destroy();
        } catch (e: any) {
          console.log('Old client cleanup (expected):', e.message);
        }
        this.client = null;
      }

      // Reset state but preserve session info if we're restoring
      this.qrCode = null;
      if (!hasExistingSession && !storedSessionInfo) {
        this.sessionInfo = null;
        this.isReady = false;
      }
      this.messageCache.clear(); // Clear message cache on reinitialize

      // Use full puppeteer with proper configuration to fix execution context issues
      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: "main_session", // Persistent session ID for session preservation
          dataPath: "./.wwebjs_auth" // Explicit data path
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-ipc-flooding-protection',
            '--memory-pressure-off',
            '--max_old_space_size=4096',
            '--disable-extensions',
            '--disable-plugins',
            '--disable-sync',
            '--disable-translate',
            '--hide-scrollbars',
            '--mute-audio',
            '--no-default-browser-check',
            '--no-pings',
            '--disable-default-apps',
            '--disable-component-extensions-with-background-pages',
            '--force-single-process-tabs',
            '--single-process',
            '--disable-process-per-site',
            '--disable-site-isolation-trials',
            `--user-data-dir=./chrome-user-data` // Use consistent directory for session persistence
          ],
          handleSIGINT: false,
          handleSIGTERM: false,
          handleSIGHUP: false,
          timeout: 90000 // 90 second timeout for initialization
        }
      });

      // Event handlers
      this.client.on('qr', (qr: string) => {
        console.log('📱 New QR Code received from WhatsApp Web');
        console.log('⚠️ Note: QR code means session was not restored or has expired');
        console.log('🔍 QR String type:', typeof qr);
        console.log('🔍 QR String length:', qr.length);
        console.log('🔍 QR String preview:', qr.substring(0, 120) + '...');
        
        try {
          // Fix: qr-image returns a stream, we need to convert it properly
          const qrStream = qrImage.image(qr, { type: 'png' });
          const chunks: Buffer[] = [];
          
          qrStream.on('data', (chunk: Buffer) => chunks.push(chunk));
          qrStream.on('end', () => {
            const qrBuffer = Buffer.concat(chunks);
            const qrDataURL = 'data:image/png;base64,' + qrBuffer.toString('base64');
            
            this.qrCode = qrDataURL;
            console.log('✅ QR Code generated successfully with qr-image');
            
            // Broadcast QR code to all connected WebSocket clients
            this.broadcastToClients('qr', { qr: qrDataURL });
          });
          
          qrStream.on('error', (error: any) => {
            console.error('❌ QR stream error:', error.message);
            this.qrCode = null;
          });
          
        } catch (qrError: any) {
          console.error('❌ QR generation with qr-image failed:', qrError.message);
          
          // Fallback: Try with QRCode library
          QRCode.toDataURL(qr)
            .then((qrDataURL: string) => {
              this.qrCode = qrDataURL;
              console.log('✅ QR Code generated successfully with fallback method');
              
              // Broadcast QR code to all connected WebSocket clients
              this.broadcastToClients('qr', { qr: qrDataURL });
            })
            .catch((fallbackError: any) => {
              console.error('❌ Fallback QR generation also failed:', fallbackError.message);
              this.qrCode = null;
            });
        }
      });

      this.client.on('ready', async () => {
        console.log('✅ WhatsApp client is ready - session restored successfully!');
        this.isReady = true;
        
        // Update session info with fresh data from client
        const freshSessionInfo = {
          number: this.client.info?.wid?.user || this.sessionInfo?.number || 'unknown',
          name: this.client.info?.pushname || this.sessionInfo?.name || 'unknown',
          loginTime: this.sessionInfo?.loginTime || new Date().toISOString()
        };
        
        this.sessionInfo = freshSessionInfo;
        
        // Clear QR code since we're now authenticated
        this.qrCode = null;
        
        console.log('🎉 Session restored automatically! User:', freshSessionInfo.name, 'Number:', freshSessionInfo.number);
        
        // Save/update session info to storage for future persistence
        try {
          // First clear any old sessions
          await storage.clearAllSessions();
          
          // Create comprehensive session backup
          const sessionBackup = {
            sessionId: "main_session",
            userId: freshSessionInfo.number,
            userName: freshSessionInfo.name,
            timestamp: new Date().toISOString(),
            status: "active"
          };
          
          // Save to backup file
          const fs = await import('fs');
          await fs.promises.writeFile('.session_backup.json', JSON.stringify(sessionBackup, null, 2));
          console.log('💾 Session backup saved to file');
          
          // Save the current active session
          await storage.saveSession({
            userId: freshSessionInfo.number,
            userName: freshSessionInfo.name,
            loginTime: new Date(freshSessionInfo.loginTime),
            sessionData: JSON.stringify(freshSessionInfo)
          });
          console.log('💾 Session info saved to storage for future persistence');
          
          // Create a backup marker file to indicate successful session
          try {
            const fs = await import('fs');
            const sessionMarker = {
              sessionId: 'main_session',
              userId: freshSessionInfo.number,
              userName: freshSessionInfo.name,
              timestamp: new Date().toISOString(),
              status: 'active'
            };
            fs.writeFileSync('./.session_backup.json', JSON.stringify(sessionMarker, null, 2));
            console.log('📄 Session backup marker created');
          } catch (fsError: any) {
            console.log('Session marker creation failed:', fsError.message);
          }
        } catch (error: any) {
          console.log('Session save failed (non-critical):', error.message);
        }
        
        // Broadcast connection status immediately
        this.broadcastToClients('connected', { 
          connected: true, 
          sessionInfo: this.sessionInfo 
        });

        // ⚡ Immediate data synchronization for superfast loading
        setTimeout(() => {
          this.performFullDataSync();
        }, 500); // Reduced from 2000ms to 500ms for faster loading
      });

      this.client.on('authenticated', () => {
        console.log('🔐 WhatsApp client authenticated successfully');
        console.log('✅ Session restoration successful - no QR code needed');
      });

      this.client.on('auth_failure', (msg: any) => {
        console.error('❌ Authentication failed:', msg);
        this.isReady = false;
        this.sessionInfo = null;
      });

      this.client.on('disconnected', (reason: any) => {
        console.log('🔌 WhatsApp client disconnected:', reason);
        this.isReady = false;
        
        // Clear session info on logout/UNPAIRED - critical for real-time updates
        if (reason === 'UNPAIRED' || reason === 'LOGOUT') {
          console.log('📱 User logged out from phone - clearing session data');
          this.sessionInfo = null;
          this.clearStoredSession();
        }
        this.qrCode = null;
        
        // Broadcast disconnection with detailed reason
        this.broadcastToClients('disconnected', { 
          connected: false, 
          reason,
          requiresNewAuth: reason === 'UNPAIRED' || reason === 'LOGOUT'
        });
        
        // If user logged out from phone, restart with QR immediately
        if (reason === 'UNPAIRED' || reason === 'LOGOUT') {
          console.log('🔄 Phone logout detected - restarting for new QR');
          this.handlePhoneLogoutRestart();
        } else {
          console.log('📋 Use /api/reconnect-whatsapp to attempt reconnection with preserved session');
          console.log('📋 Use /api/force-restart-whatsapp to start fresh with QR code');
        }
      });

      // Real-time message handling
      this.client.on('message', (message: any) => {
        this.storeRealtimeMessage(message);
      });

      // Listen for outgoing messages sent from phone
      this.client.on('message_create', (message: any) => {
        if (message.fromMe) {
          console.log('📱 Outgoing message from phone detected');
          this.storeRealtimeMessage(message);
        }
      });

      console.log('✅ Starting client initialization...');
      try {
        await this.client.initialize();
        console.log('🎯 Client initialization completed successfully');
      } catch (initError: any) {
        console.error('❌ Client initialization failed:', initError.message);
        
        // If initialization fails, reset and try again after delay
        this.isInitializing = false;
        this.client = null;
        
        setTimeout(() => {
          console.log('🔄 Retrying client initialization after failure...');
          this.initializeClient();
        }, 5000);
        
        throw initError;
      }

    } catch (error: any) {
      console.error('❌ WhatsApp client initialization failed:', error.message);
      console.error('Error details:', error);
      this.isReady = false;
      this.sessionInfo = null;
      this.qrCode = null;
      
      // Handle specific error types
      if (error.message.includes('Protocol error') || 
          error.message.includes('Target closed') ||
          error.message.includes('Navigation timeout')) {
        console.log('🔧 Protocol/Connection error handled - attempting clean restart');
        // Clean restart for protocol errors
        setTimeout(() => {
          this.initializeClient();
        }, 5000);
      } else {
        // Attempt retry after a delay for other transient network issues
        console.log('🔄 Scheduling retry in 10 seconds...');
        setTimeout(() => {
          if (!this.isReady && !this.isInitializing) {
            console.log('🔄 Retrying WhatsApp client initialization...');
            this.initializeClient();
          }
        }, 10000);
      }
      
      console.log('Browser failed to initialize - QR will be available when browser starts');
    } finally {
      this.isInitializing = false;
    }
  }

  async logout(): Promise<void> {
    try {
      console.log('🔌 Starting comprehensive logout process...');
      
      // Use the same logic as force restart but with UI logout
      await this.performCompleteLogout();
      
    } catch (error: any) {
      console.error('❌ Logout failed:', error.message);
      throw error;
    }
  }

  private async performCompleteLogout(): Promise<void> {
    // Stop connection monitoring to prevent conflicts
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
    
    // Clear session info first
    this.sessionInfo = null;
    this.qrCode = null;
    this.isReady = false;
    this.messageCache.clear();
    
    // Clear storage
    await storage.clearAllSessions();
    
    // Enhanced logout with phone disconnection
    if (this.client) {
      try {
        console.log('🎯 Attempting comprehensive logout with phone disconnection...');
        
        // Method 1: PRIORITY - Use client.logout() to properly unlink phone
        try {
          console.log('📱 CRITICAL: Calling client.logout() to unlink from phone\'s Linked Devices...');
          await this.client.logout();
          console.log('✅ Phone successfully unlinked from Linked Devices list');
          
          // Wait for logout to fully process on WhatsApp servers
          await new Promise(resolve => setTimeout(resolve, 4000));
        } catch (logoutError: any) {
          console.log('⚠️ Primary logout failed, trying fallback methods:', logoutError.message);
          
          // Fallback: Try UI-based logout if API fails
          try {
            const page = await this.client.pupPage;
            if (page) {
              console.log('📱 Fallback: UI-based logout to disconnect phone...');
              
              const uiLogoutPromise = page.evaluate(() => {
                try {
                  const menuBtn = document.querySelector("span[data-icon='menu']");
                  if (menuBtn) {
                    (menuBtn as HTMLElement).click();
                    setTimeout(() => {
                      const logoutElements = Array.from(document.querySelectorAll('div')).filter(
                        el => el.textContent?.includes('Log out')
                      );
                      if (logoutElements.length > 0) {
                        (logoutElements[0] as HTMLElement).click();
                        setTimeout(() => {
                          const confirmElements = Array.from(document.querySelectorAll('div')).filter(
                            el => el.textContent?.includes('Log out')
                          );
                          if (confirmElements.length > 0) {
                            (confirmElements[0] as HTMLElement).click();
                          }
                        }, 1000);
                      }
                    }, 1000);
                  }
                } catch (e) {
                  console.log('UI logout failed:', e);
                }
              });
              
              const timeoutPromise = new Promise(resolve => setTimeout(resolve, 5000));
              await Promise.race([uiLogoutPromise, timeoutPromise]);
              console.log('✅ Fallback UI logout completed');
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } catch (pageError: any) {
            console.log('🔧 Fallback also failed (expected during logout):', pageError.message);
          }
        }
        
        // Method 2: CRITICAL - Standard client logout to unlink from phone
        try {
          console.log('📱 Calling client.logout() to unlink from phone\'s Linked Devices...');
          await this.client.logout();
          console.log('✅ Phone successfully unlinked from Linked Devices');
          // Wait longer for logout to fully process on WhatsApp servers
          await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (logoutError: any) {
          console.log('⚠️ Client logout failed - phone may still be linked:', logoutError.message);
        }
        
        // Method 3: Destroy client with timeout
        console.log('🧹 Destroying WhatsApp client...');
        try {
          const destroyPromise = this.client.destroy();
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('timeout')), 5000)
          );
          await Promise.race([destroyPromise, timeoutPromise]);
          console.log('✅ Client destroyed');
        } catch (destroyError: any) {
          console.log('🔧 Client destruction completed (expected)');
        }
        
        this.client = null;
      } catch (clientError: any) {
        console.log('Client operation completed:', clientError.message);
      }
    }
    
    // Force clear all session data
    await this.clearAllSessionData();
    
    // Broadcast logout event
    this.broadcastToClients('logout', { connected: false });
    
    // Start fresh with delay
    setTimeout(async () => {
      console.log('🔄 Starting completely fresh client...');
      this.isInitializing = false;
      try {
        await this.initializeClient();
        console.log('✅ Fresh client started successfully');
      } catch (error: any) {
        console.error('❌ Fresh client start failed:', error.message);
        // Retry with longer delay
        setTimeout(() => {
          this.isInitializing = false;
          this.initializeClient();
        }, 5000);
      }
    }, 3000);
  }

  private async clearAllSessionData(): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      // Kill any remaining Chrome processes first
      try {
        const { execSync } = await import('child_process');
        execSync('pkill -f chrome || pkill -f chromium || true', { stdio: 'ignore' });
        console.log('🔫 Killed existing Chrome processes');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for processes to die
      } catch (e) {
        // Process kill might fail, that's OK
      }
      
      const pathsToClean = [
        './.wwebjs_auth',
        './.chrome_user_data',
        './.session_backup.json'
      ];
      
      for (const dirPath of pathsToClean) {
        const fullPath = path.resolve(dirPath);
        if (fs.existsSync(fullPath)) {
          // For Chrome data directory, clear lock files first
          if (dirPath === './.chrome_user_data') {
            try {
              const lockFiles = [
                path.join(fullPath, 'SingletonLock'),
                path.join(fullPath, 'SingletonSocket'),
                path.join(fullPath, 'Default', 'Session Storage'),
                path.join(fullPath, 'Default', 'Local Storage')
              ];
              
              for (const lockFile of lockFiles) {
                if (fs.existsSync(lockFile)) {
                  if (fs.statSync(lockFile).isDirectory()) {
                    fs.rmSync(lockFile, { recursive: true, force: true });
                  } else {
                    fs.unlinkSync(lockFile);
                  }
                  console.log(`🔓 Removed lock: ${path.basename(lockFile)}`);
                }
              }
            } catch (e) {}
          }
          
          if (fs.statSync(fullPath).isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
            console.log(`🗑️ Cleared directory: ${dirPath}`);
          } else {
            fs.unlinkSync(fullPath);
            console.log(`🗑️ Cleared file: ${dirPath}`);
          }
        }
      }
      
      // Also clear temp Chrome data
      const tmpDir = '/tmp';
      try {
        const chromeDataDirs = fs.readdirSync(tmpDir).filter(dir => 
          dir.startsWith('chrome-') || dir.startsWith('chromium-')
        );
        for (const dir of chromeDataDirs) {
          try {
            fs.rmSync(path.join(tmpDir, dir), { recursive: true, force: true });
            console.log(`🗑️ Cleared temp Chrome data: ${dir}`);
          } catch (e) {}
        }
      } catch (e) {}
      
      // Wait a bit more for filesystem to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (fsError: any) {
      console.log('Session cleanup:', fsError.message);
    }
  }

  private async clearStoredSession(): Promise<void> {
    try {
      await storage.clearAllSessions();
      console.log('🗑️ Cleared stored session data from database');
    } catch (error: any) {
      console.log('Session clear failed:', error.message);
    }
  }

  private startConnectionMonitoring(): void {
    // Real-time connection monitoring every 30 seconds - reduced frequency to prevent aggressive restarts
    this.connectionCheckInterval = setInterval(async () => {
      await this.checkRealTimeConnection();
    }, 30000);
  }

  private async checkRealTimeConnection() {
    try {
      if (!this.client) {
        this.updateConnectionState('DISCONNECTED', false);
        return;
      }

      // Get real-time state from WhatsApp Web instance
      const currentState = await this.client.getState();
      const wasConnected = this.isPhoneConnected;
      const isNowConnected = currentState === 'CONNECTED';
      
      // Only broadcast if state actually changed
      if (this.currentState !== currentState || this.isPhoneConnected !== isNowConnected) {
        console.log(`🔌 Phone connection changed: ${this.currentState} → ${currentState} | Phone: ${this.isPhoneConnected ? 'Connected' : 'Disconnected'} → ${isNowConnected ? 'Connected' : 'Disconnected'}`);
        
        this.updateConnectionState(currentState, isNowConnected);
        
        // If phone disconnected, clear session info immediately  
        if (wasConnected && !isNowConnected) {
          console.log('📱 Phone disconnected - clearing session data');
          this.sessionInfo = null;
          this.isReady = false;
        }
        
        // Handle different disconnection states (disabled automatic restart)
        if (currentState === 'UNPAIRED' || currentState === 'UNPAIRED_IDLE') {
          console.log('📱 Phone was unpaired - but not auto-restarting to prevent connection loops');
          // this.handleUnpairedRestart(); // Disabled to prevent automatic logouts
        }
      }
      
      this.lastStateCheck = new Date();
    } catch (error: any) {
      // Connection check failed - likely means client is broken
      console.log('⚠️ Connection health check failed:', error.message);
      this.updateConnectionState('TIMEOUT', false);
      this.isReady = false;
    }
  }

  private updateConnectionState(state: string, phoneConnected: boolean) {
    this.currentState = state;
    this.isPhoneConnected = phoneConnected;
    
    // Broadcast real-time status update
    this.broadcastToClients('connection_status', {
      connected: phoneConnected,
      state: state,
      sessionInfo: phoneConnected ? this.sessionInfo : null,
      timestamp: new Date().toISOString(),
      isRealTime: true
    });
  }

  private handleUnpairedRestart(): void {
    console.log('📱 Handling unpaired restart event');
    this.isReady = false;
    this.sessionInfo = null;
    this.qrCode = null;
    
    // Clear stored session data
    this.clearStoredSession();
    
    // Broadcast disconnection with unpaired reason
    this.broadcastToClients('disconnected', { 
      connected: false, 
      reason: 'UNPAIRED',
      requiresNewAuth: true
    });
    
    // Restart to get new QR
    setTimeout(() => {
      this.handlePhoneLogoutRestart();
    }, 2000);
  }

  private async handlePhoneLogoutRestart(): Promise<void> {
    try {
      console.log('🔄 Starting safe restart after phone logout...');
      
      // Stop connection monitoring to prevent conflicts
      if (this.connectionCheckInterval) {
        clearInterval(this.connectionCheckInterval);
        this.connectionCheckInterval = null;
      }
      
      // Set initialization flag to prevent multiple restarts
      this.isInitializing = true;
      
      // Clean destroy current client if it exists
      if (this.client) {
        try {
          console.log('🧹 Safely destroying existing client...');
          
          // Add timeout to prevent hanging on destroy
          const destroyPromise = this.client.destroy();
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Destroy timeout')), 5000)
          );
          
          await Promise.race([destroyPromise, timeoutPromise]);
          console.log('✅ Client destroyed successfully');
        } catch (destroyError: any) {
          // Handle ProtocolError and other cleanup errors gracefully
          if (destroyError.message.includes('Protocol error') || 
              destroyError.message.includes('Target closed') ||
              destroyError.message.includes('Destroy timeout')) {
            console.log('🔧 Client cleanup completed (expected during phone logout)');
          } else {
            console.log('Client destroy error:', destroyError.message);
          }
        }
        this.client = null;
      }
      
      // Clear session files to force fresh start
      try {
        const fs = await import('fs');
        const path = await import('path');
        const sessionPath = path.resolve('./.wwebjs_auth');
        const chromeDataPath = path.resolve('./.chrome_user_data');
        
        if (fs.existsSync(sessionPath)) {
          fs.rmSync(sessionPath, { recursive: true, force: true });
          console.log('🗑️ Session files cleared for fresh start');
        }
        
        if (fs.existsSync(chromeDataPath)) {
          fs.rmSync(chromeDataPath, { recursive: true, force: true });
          console.log('🗑️ Chrome data cleared for fresh start');
        }
      } catch (fsError: any) {
        console.log('File cleanup:', fsError.message);
      }
      
      // Wait for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Reset flags
      this.isInitializing = false;
      
      // Restart client
      console.log('🚀 Restarting client for new QR...');
      await this.initializeClient();
      
    } catch (error: any) {
      console.error('❌ Restart after logout failed:', error.message);
      this.isInitializing = false;
      
      // Handle ProtocolError gracefully - it's expected during logout
      if (error.message.includes('Protocol error') || 
          error.message.includes('Target closed')) {
        console.log('🔧 ProtocolError handled - this is expected during phone logout');
        // Continue with restart anyway
        setTimeout(() => {
          this.initializeClient();
        }, 3000);
      } else {
        // Fallback: try again after longer delay for other errors
        setTimeout(() => {
          this.initializeClient();
        }, 10000);
      }
    }
  }

  private handleConnectionLost(): void {
    console.log('🔌 Handling connection lost event');
    this.isReady = false;
    
    // Don't clear session info immediately - might be temporary
    // this.sessionInfo = null;
    
    // Broadcast disconnection
    this.broadcastToClients('disconnected', { 
      connected: false, 
      reason: 'CONNECTION_LOST',
      requiresNewAuth: false // Might reconnect with same session
    });
  }

  async getQRCode(): Promise<string | null> {
    return this.qrCode;
  }

  async forceRefreshQR() {
    console.log('🔄 Force refreshing QR code by reinitializing client...');
    await this.completeRestart();
  }

  async completeRestart() {
    console.log('🔄 Starting complete WhatsApp client restart (CLEARING SESSION)...');
    
    // Reset all state
    this.qrCode = null;
    this.sessionInfo = null;
    this.isReady = false;
    this.isInitializing = false;
    this.messageCache.clear();
    
    // Destroy existing client
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (e: any) {
        console.log('Client cleanup during restart:', e?.message);
      }
    }
    this.client = null;
    
    // Clear session storage
    try {
      await storage.clearAllSessions();
    } catch (e: any) {
      console.log('Storage cleanup during restart:', e?.message);
    }
    
    // Clear session files - ONLY when doing complete restart
    try {
      const fs = await import('fs');
      const path = await import('path');
      const sessionPath = path.resolve('./.wwebjs_auth');
      const chromeDataPath = path.resolve('./.chrome_user_data');
      
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log('🗑️ WhatsApp session files cleared');
      }
      
      if (fs.existsSync(chromeDataPath)) {
        fs.rmSync(chromeDataPath, { recursive: true, force: true });
        console.log('🗑️ Chrome user data cleared');
      }
    } catch (fsError: any) {
      console.log('Session file cleanup:', fsError.message);
    }
    
    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Reinitialize
    await this.initializeClient();
  }

  async reconnectWithoutClearing() {
    console.log('🔄 Starting WhatsApp client reconnection (PRESERVING SESSION)...');
    
    // Check if we have valid session files before attempting reconnection
    const fs = await import('fs');
    const sessionPath = './.wwebjs_auth/session-main_session';
    
    // Reset state but keep session info for restoration
    const preservedSessionInfo = this.sessionInfo;
    this.qrCode = null;
    this.isReady = false;
    this.isInitializing = false;
    
    // Destroy existing client but preserve session files
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (e: any) {
        console.log('Client cleanup during reconnection:', e?.message);
      }
    }
    this.client = null;
    
    // Restore session info
    this.sessionInfo = preservedSessionInfo;
    
    if (fs.existsSync(sessionPath)) {
      const sessionContents = fs.readdirSync(sessionPath);
      if (sessionContents.length > 0) {
        console.log('📱 Reconnecting with preserved session files...');
        console.log('📄 Session files found:', sessionContents.length, 'files');
      } else {
        console.log('⚠️ Session directory exists but is empty - QR scan will be required');
      }
    } else {
      console.log('⚠️ No session files found - QR scan will be required');
    }
    
    // Don't clear session files or storage - just reinitialize
    await this.initializeClient();
  }

  async getSessionInfo() {
    // First check in-memory session
    if (this.sessionInfo && this.isReady) {
      return this.sessionInfo;
    }
    
    // If no in-memory session, try to restore from storage
    try {
      const activeSessions = await storage.getActiveSessions();
      if (activeSessions.length > 0) {
        const storedSession = activeSessions[0];
        console.log('📦 Restoring session info from storage');
        
        this.sessionInfo = {
          number: storedSession.userId,
          name: storedSession.userName,
          loginTime: storedSession.loginTime
        };
        
        // If we have session files and stored session, mark as ready
        const fs = await import('fs');
        const path = await import('path');
        const sessionPath = path.resolve('./.wwebjs_auth');
        
        if (fs.existsSync(sessionPath)) {
          this.isReady = true;
          console.log('✅ Session restored from storage with file verification');
          return this.sessionInfo;
        }
      }
    } catch (error: any) {
      console.log('Session restoration failed:', error.message);
    }
    
    return null;
  }

  async isClientReady(): Promise<boolean> {
    return this.isReady;
  }

  async sendMessage(phoneNumber: string, message: string): Promise<any> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp is not connected. Please scan the QR code to connect your WhatsApp account.');
    }

    try {
      let chatId: string;
      
      // Check if it's already a WhatsApp ID (group or individual)
      if (phoneNumber.includes('@')) {
        chatId = phoneNumber;
        console.log(`📤 Sending message to chat ID ${phoneNumber}: ${message.substring(0, 50)}...`);
      } else {
        // Format phone number properly for individual contacts
        let formattedNumber = phoneNumber.replace(/\D/g, '');
        
        if (formattedNumber.startsWith('1')) {
          formattedNumber = formattedNumber;
        } else if (formattedNumber.length === 10) {
          formattedNumber = '1' + formattedNumber;
        }
        
        chatId = formattedNumber + '@c.us';
        console.log(`📤 Sending message to ${formattedNumber}: ${message.substring(0, 50)}...`);
      }
      
      const result = await this.client.sendMessage(chatId, message);
      
      console.log('✅ Message sent successfully');
      return result;
      
    } catch (error: any) {
      console.error('❌ Failed to send message:', error.message);
      
      // Check if error is due to disconnection and update status
      if (error.message.includes('Cannot read properties of undefined') || 
          error.message.includes('getChat') ||
          error.message.includes('Session closed') ||
          error.message.includes('Protocol error')) {
        console.log('🔌 Connection lost during message send - updating status');
        this.isReady = false;
        
        // Broadcast disconnection status
        this.broadcastToClients('disconnected', { 
          connected: false, 
          reason: 'CONNECTION_LOST',
          requiresNewAuth: true
        });
        
        throw new Error('WhatsApp connection lost. Please refresh the page and reconnect by scanning the QR code.');
      }
      
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  async sendMediaMessage(phoneNumber: string, message: string, mediaPath: string, fileName: string): Promise<any> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp is not connected. Please scan the QR code to connect your WhatsApp account.');
    }

    try {
      console.log(`📄 Processing media message: ${fileName} at ${mediaPath}`);
      
      // Validate media path exists
      const fs = await import('fs');
      if (!mediaPath || !fs.existsSync(mediaPath)) {
        throw new Error(`Media file not found at path: ${mediaPath}`);
      }

      console.log(`📊 File stats: ${JSON.stringify(fs.statSync(mediaPath))}`);
      console.log(`🔍 MessageMedia availability:`, { MessageMedia: typeof MessageMedia, fromFilePath: typeof MessageMedia?.fromFilePath });
      
      if (!MessageMedia || typeof MessageMedia.fromFilePath !== 'function') {
        throw new Error('MessageMedia.fromFilePath is not available. WhatsApp Web.js may not be properly initialized.');
      }
      
      const media = MessageMedia.fromFilePath(mediaPath);
      
      if (!media) {
        throw new Error('Failed to create MessageMedia from file');
      }
      
      // Set proper filename and ensure correct mime type
      media.filename = fileName;
      
      // Detect and set proper mime type based on file extension if not detected
      if (!media.mimetype || media.mimetype === 'unknown mimetype') {
        const fileExtension = fileName.toLowerCase().split('.').pop();
        const mimeTypeMap: Record<string, string> = {
          'txt': 'text/plain',
          'pdf': 'application/pdf',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'mp4': 'video/mp4',
          'mp3': 'audio/mpeg',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        };
        
        if (fileExtension && mimeTypeMap[fileExtension]) {
          media.mimetype = mimeTypeMap[fileExtension];
        }
      }
      
      console.log(`📄 Media created successfully: ${media.mimetype || 'application/octet-stream'}, filename: ${media.filename}`);
      
      let chatId: string;
      
      // Check if it's already a WhatsApp ID (group or individual)
      if (phoneNumber.includes('@')) {
        chatId = phoneNumber;
        console.log(`📤 Sending media message to chat ID ${phoneNumber}: ${fileName}`);
      } else {
        // Format phone number properly for individual contacts
        let formattedNumber = phoneNumber.replace(/\D/g, '');
        if (formattedNumber.startsWith('1')) {
          formattedNumber = formattedNumber;
        } else if (formattedNumber.length === 10) {
          formattedNumber = '1' + formattedNumber;
        }
        
        chatId = formattedNumber + '@c.us';
        console.log(`📤 Sending media message to ${formattedNumber}: ${fileName}`);
      }
      
      const result = await this.client.sendMessage(chatId, media, { caption: message });
      
      console.log('✅ Media message sent successfully');
      return { messageId: result.id?.id, fileName };
      
    } catch (error: any) {
      console.error('❌ Failed to send media message:', error.message);
      console.error('❌ Full error details:', error);
      
      // Check if error is due to file path issues
      if (error.message.includes('fromFilePath') || error.message.includes('ENOENT')) {
        throw new Error(`File access error: ${error.message}. Please try uploading the file again.`);
      }
      
      // Check if error is due to disconnection and update status
      if (error.message.includes('Cannot read properties of undefined') || 
          error.message.includes('getChat') ||
          error.message.includes('Session closed') ||
          error.message.includes('Protocol error')) {
        console.log('🔌 Connection lost during media message send - updating status');
        this.isReady = false;
        
        // Broadcast disconnection status
        this.broadcastToClients('disconnected', { 
          connected: false, 
          reason: 'CONNECTION_LOST',
          requiresNewAuth: true
        });
        
        throw new Error('WhatsApp connection lost. Please refresh the page and reconnect by scanning the QR code.');
      }
      
      throw new Error(`Failed to send media message: ${error.message}`);
    }
  }

  async getChatHistory(chatId: string, limit: number = 50): Promise<{contact: any, messages: any[]}> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {

      const chat = await this.client.getChatById(chatId);
      const messages = await chat.fetchMessages({ limit });
      
      // First, get all contacts for name resolution
      let allContacts: any[] = [];
      try {
        allContacts = await this.client.getContacts();
      } catch (error) {
        console.log('Failed to get contacts for name resolution:', error);
      }

      const messageData = messages
        .filter((msg: any) => {
          // Filter out system messages, notifications, and messages that are just phone numbers
          const isSystemMessage = msg.type === 'e2e_notification' || 
                                   msg.type === 'notification_template' ||
                                   msg.type === 'call_log' ||
                                   msg.type === 'protocol';
          
          const isPhoneNumberOnly = msg.body && /^[\d@c.us]+$/.test(msg.body.replace(/\s/g, ''));
          const isEmpty = !msg.body || msg.body.trim() === '';
          
          // Enhanced media detection for filtering
          const hasMediaContent = msg.hasMedia || 
                                ['image', 'video', 'audio', 'ptt', 'document', 'sticker'].includes(msg.type) ||
                                msg._data?.type === 'media' ||
                                msg._data?.mimetype ||
                                msg._data?.isMedia;

          // Remove debug logging to reduce console noise
          
          // Keep real chat messages, media messages (even with empty body), and system messages with meaningful content
          // Media messages should be kept even if they have empty body
          return !isSystemMessage && !isPhoneNumberOnly && (!isEmpty || hasMediaContent);
        })
        .map((msg: any) => {
          // Enhanced contact name resolution for group messages
          let authorName = null;
          if (!msg.fromMe && msg.author) {
            // Look for the contact in the pre-fetched contacts list
            const matchingContact = allContacts.find((contact: any) => 
              contact.id._serialized === msg.author
            );
            
            if (matchingContact) {
              // Prioritize saved contact name over pushname
              if (matchingContact.isMyContact && matchingContact.name && matchingContact.name !== matchingContact.id.user) {
                authorName = matchingContact.name;
              } else if (matchingContact.pushname && matchingContact.pushname !== matchingContact.id.user) {
                authorName = matchingContact.pushname;
              } else {
                // Fallback to formatted phone number
                authorName = this.formatPhoneNumber(msg.author);
              }
            } else {
              // If no contact found, use notify name or format phone number
              authorName = msg._data?.notifyName || this.formatPhoneNumber(msg.author);
            }
          }

          // Better media detection - check multiple properties
          const hasMedia = msg.hasMedia || 
                           ['image', 'video', 'audio', 'ptt', 'document', 'sticker'].includes(msg.type) ||
                           msg._data?.type === 'media' ||
                           msg._data?.mimetype ||
                           msg._data?.isMedia;

          // Media detection working properly

          return {
            id: msg.id?.id || Date.now().toString(),
            body: msg.body || (hasMedia ? '[Media]' : ''),
            timestamp: msg.timestamp || Date.now(),
            fromMe: msg.fromMe || false,
            type: msg.type || 'chat',
            author: authorName,
            hasMedia: hasMedia,
            mediaUrl: hasMedia ? `/api/media/${msg.id?.id}` : undefined,
            fileName: hasMedia && msg._data?.filename ? msg._data.filename : undefined
          };
        });

      // Extract contact information from the chat
      const contact = {
        id: chat.id._serialized,
        name: chat.name || chat.pushname || 'Unknown',
        number: chat.id.user || chatId.split('@')[0],
        isMyContact: false, // Will be determined by checking contacts
        isWAContact: true,
        profilePicUrl: null,
        isGroup: chat.isGroup || false,
        // Add group-specific properties
        participants: chat.isGroup ? (chat.participants || []) : undefined,
        onlyAdminsCanMessage: chat.isGroup ? (chat.groupMetadata?.restrict || false) : false,
        isAdmin: chat.isGroup ? this.isUserGroupAdmin(chat) : false
      };


      return {
        contact,
        messages: messageData
      };
    } catch (error: any) {
      console.error('❌ Failed to fetch chat history:', error.message);
      throw error;
    }
  }

  // Helper method to check if user is admin in a group
  private isUserGroupAdmin(chat: any): boolean {
    try {
      if (!chat.isGroup || !chat.participants) return false;
      
      const myNumber = this.sessionInfo?.number;
      if (!myNumber) return false;
      
      const myParticipant = chat.participants.find((p: any) => 
        p.id._serialized.includes(myNumber) || p.id.user === myNumber
      );
      
      return myParticipant?.isAdmin || myParticipant?.isSuperAdmin || false;
    } catch (error) {
      console.log('Error checking admin status:', error);
      return false;
    }
  }

  // Download media from a message
  async downloadMessageMedia(messageId: string): Promise<any> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      console.log(`📥 Downloading media for message ${messageId}`);
      
      // Find the message across all chats
      const chats = await this.client.getChats();
      let targetMessage = null;
      
      for (const chat of chats) {
        const messages = await chat.fetchMessages({ limit: 100 });
        targetMessage = messages.find((msg: any) => msg.id?.id === messageId);
        if (targetMessage) break;
      }
      
      if (!targetMessage) {
        throw new Error('Message not found');
      }
      
      if (!targetMessage.hasMedia) {
        throw new Error('Message has no media');
      }
      
      // Download the media
      const media = await targetMessage.downloadMedia();
      
      if (!media) {
        throw new Error('Failed to download media');
      }
      
      console.log(`✅ Media downloaded successfully for message ${messageId}`);
      
      return {
        data: Buffer.from(media.data, 'base64'),
        mimetype: media.mimetype,
        filename: media.filename || `media_${messageId}`
      };
      
    } catch (error: any) {
      console.error('❌ Failed to download media:', error.message);
      throw error;
    }
  }

  private async storeRealtimeMessage(message: any) {
    try {
      if (!message) return;
      
      console.log('💬 New real-time message received:', {
        from: message.from,
        to: message.to,
        body: message.body?.substring(0, 50) + '...',
        fromMe: message.fromMe,
        type: message.type
      });
      
      // Extract contact ID from message
      let contactId = message.from || 'unknown';
      
      // Normalize contact ID
      contactId = contactId.replace('@c.us', '').replace('@g.us', '');
      
      // Get or create message array for this contact
      let messages = this.messageCache.get(contactId) || [];
      
      // Add new message
      const messageData = {
        id: message.id?.id || Date.now().toString(),
        timestamp: message.timestamp || Date.now(),
        body: message.body || '',
        fromMe: message.fromMe || false,
        type: message.type || 'chat',
        author: message.author || null,
        to: message.to || contactId,
        hasMedia: message.hasMedia || false
      };
      
      messages.push(messageData);
      
      // Keep only last 100 messages per contact
      if (messages.length > 100) {
        messages = messages.slice(-100);
      }
      
      // Update cache
      this.messageCache.set(contactId, messages);
      
      // Broadcast new message to all WebSocket clients for real-time updates
      this.broadcastToClients('new_message', {
        chatId: message.from, // Full chat ID (with @c.us or @g.us)
        message: messageData,
        contactName: message._data?.notifyName || message.from
      });
      

      
    } catch (error: any) {
      console.error('Failed to store realtime message:', error.message);
    }
  }

  // Fast data loading methods for chats, groups, and contacts
  // Helper method to get chats without broadcasting (prevents recursion)
  private async getChatsWithoutBroadcast(): Promise<any[]> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    // Additional check to ensure client is actually connected
    if (!this.client.info || !this.client.info.wid) {
      throw new Error('WhatsApp client not fully connected');
    }

    try {
      
      // ⚡ Fast timeout for better performance
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout fetching chats')), 10000); // Reduced from 30s to 10s
      });
      
      const chatsPromise = this.client.getChats();
      const chats = await Promise.race([chatsPromise, timeoutPromise]);
      
      // Filter out status@broadcast, other broadcast chats, and archived chats
      const filteredChats = chats.filter((chat: any) => 
        !chat.id._serialized.includes('status@broadcast') && 
        !chat.id._serialized.includes('@broadcast') &&
        !chat.archived // Hide archived chats from main list
      );
      
      const chatData = filteredChats.map((chat: any) => ({
        id: chat.id._serialized,
        name: chat.name || chat.pushname || chat.id.user,
        isGroup: chat.isGroup,
        timestamp: chat.timestamp,
        unreadCount: chat.unreadCount,
        isArchived: chat.archived,
        isPinned: chat.pinned,
        lastMessage: chat.lastMessage ? {
          body: chat.lastMessage.body,
          timestamp: chat.lastMessage.timestamp,
          fromMe: chat.lastMessage.fromMe
        } : null,
        profilePicUrl: null // Will be loaded separately for performance
      }));

      // Sort chats by latest activity (most recent first)
      const sortedChats = chatData.sort((a: any, b: any) => {
        // Use lastMessage timestamp if available, otherwise fallback to chat timestamp
        const timestampA = Math.max(a.lastMessage?.timestamp || 0, a.timestamp || 0);
        const timestampB = Math.max(b.lastMessage?.timestamp || 0, b.timestamp || 0);
        
        return timestampB - timestampA; // Latest at top
      });

      return sortedChats;
    } catch (error: any) {
      console.error('❌ Failed to fetch chats:', error.message);
      console.log('Get chats error:', error);
      throw error;
    }
  }

  async getChats(): Promise<any[]> {
    try {
      // Use helper method and broadcast the result
      const sortedChats = await this.getChatsWithoutBroadcast();
      
      // Broadcast to WebSocket clients for real-time updates
      this.broadcastToClients('chats_updated', { chats: sortedChats });
      
      return sortedChats;
    } catch (error: any) {
      console.error('❌ Failed to fetch chats:', error.message);
      throw error;
    }
  }

  async getContacts(): Promise<any[]> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    // Additional check to ensure client is actually connected
    if (!this.client.info || !this.client.info.wid) {
      throw new Error('WhatsApp client not fully connected');
    }

    try {
      
      // ⚡ Fast timeout for better performance  
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout fetching contacts')), 10000); // Reduced from 30s to 10s
      });
      
      const contactsPromise = this.client.getContacts();
      const contacts = await Promise.race([contactsPromise, timeoutPromise]);
      

      
      const contactData = contacts.map((contact: any) => ({
        id: contact.id._serialized,
        name: contact.name || contact.pushname || contact.id.user,
        number: contact.number || contact.id.user,
        isMyContact: contact.isMyContact,
        isUser: contact.isUser,
        isWAContact: contact.isWAContact,
        profilePicUrl: null, // Will be loaded separately for performance
        status: null, // Will be loaded separately for performance
        isGroup: false // Contacts are not groups
      }));

      // Log filtering statistics
      const isWAContactCount = contactData.filter((c: any) => c.isWAContact).length;
      const isMyContactCount = contactData.filter((c: any) => c.isMyContact).length;
      const bothCount = contactData.filter((c: any) => c.isWAContact && c.isMyContact).length;
      const hasNameCount = contactData.filter((c: any) => c.isWAContact && c.isMyContact && c.name).length;
      const hasNumberCount = contactData.filter((c: any) => c.isWAContact && c.isMyContact && c.name && c.number).length;

      // Helper function to validate phone numbers
      const isValidPhoneNumber = (phoneNumber: string): boolean => {
        if (!phoneNumber) return false;
        
        // Remove all non-digit characters for length checking
        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        
        // Reject numbers with 15+ digits (likely invalid/spam numbers)
        if (cleanNumber.length >= 15) {
          return false;
        }
        
        // Reject numbers that are too short (less than 7 digits)
        if (cleanNumber.length < 7) {
          return false;
        }
        
        return true;
      };

      const filteredContacts = contactData.filter((contact: any) => {
        // More inclusive filtering to show all saved WhatsApp contacts with valid phone numbers
        return contact.isWAContact && 
               contact.isMyContact && 
               contact.name && 
               contact.number &&
               !contact.id.includes('@g.us') && // Exclude group IDs
               !contact.id.includes('status@broadcast') && // Exclude status broadcasts
               isValidPhoneNumber(contact.number); // Exclude invalid phone numbers
      });

      // Calculate validation statistics
      const beforeValidation = contactData.filter((c: any) => 
        c.isWAContact && c.isMyContact && c.name && c.number &&
        !c.id.includes('@g.us') && !c.id.includes('status@broadcast')
      ).length;
      const invalidPhoneNumbers = beforeValidation - filteredContacts.length;



      // Sort contacts alphabetically (A-Z) by name
      const sortedContacts = filteredContacts.sort((a: any, b: any) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });


      
      // Broadcast to WebSocket clients for real-time updates
      this.broadcastToClients('contacts_updated', sortedContacts);
      
      return sortedContacts;
    } catch (error: any) {
      console.error('❌ Failed to fetch contacts:', error.message);
      throw error;
    }
  }

  async getGroups(): Promise<any[]> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {

      const chats = await this.client.getChats();
      const groups = chats.filter((chat: any) => 
        chat.isGroup && 
        !chat.id._serialized.includes('status@broadcast') && 
        !chat.id._serialized.includes('@broadcast') &&
        chat.participants && 
        chat.participants.length > 0
      );
      
      const groupData = await Promise.all(
        groups.map(async (group: any) => {
          try {
            const participants = await group.participants || [];
            
            // Get current user's WhatsApp number to check admin status
            const currentUserNumber = this.client?.info?.me?.user || this.client?.info?.wid?.user;
            const currentUserParticipant = participants.find((p: any) => 
              p.id._serialized.includes(currentUserNumber)
            );
            
            // Check if current user is admin in this group
            const isAdmin = currentUserParticipant ? (currentUserParticipant.isAdmin || currentUserParticipant.isSuperAdmin) : false;
            
            // Check if group has admin-only messaging enabled using the announce property
            let onlyAdminsCanMessage = false;
            try {
              // Method 1: Try to get chat object which might have group metadata
              const chatObj = await this.client.getChatById(group.id._serialized);
              if (chatObj && chatObj.isGroup && chatObj.groupMetadata) {
                onlyAdminsCanMessage = chatObj.groupMetadata.announce || false;
                console.log(`Group ${group.name}: announce=${chatObj.groupMetadata.announce}, onlyAdminsCanMessage=${onlyAdminsCanMessage}`);
              } else {
                // Method 2: Try direct access to group properties
                onlyAdminsCanMessage = group.groupMetadata?.announce || group.announce || false;
                console.log(`Group ${group.name}: Using fallback method, onlyAdminsCanMessage=${onlyAdminsCanMessage}`);
              }
            } catch (metadataError: any) {
              console.log(`Could not fetch group metadata for ${group.name}: ${metadataError.message}`);
              // Final fallback: check if group object has announce property directly
              onlyAdminsCanMessage = group.groupMetadata?.announce || group.announce || false;
              console.log(`Group ${group.name}: Using final fallback, onlyAdminsCanMessage=${onlyAdminsCanMessage}`);
            }
            
            return {
              id: group.id._serialized,
              name: group.name,
              description: group.description || '',
              participantCount: participants.length,
              participants: participants.map((p: any) => ({
                id: p.id._serialized,
                isAdmin: p.isAdmin,
                isSuperAdmin: p.isSuperAdmin
              })),
              timestamp: group.timestamp,
              unreadCount: group.unreadCount,
              lastMessage: group.lastMessage ? {
                body: group.lastMessage.body,
                timestamp: group.lastMessage.timestamp,
                fromMe: group.lastMessage.fromMe
              } : null,
              profilePicUrl: null, // Will be loaded separately for performance
              isGroup: true, // Mark as group for proper message routing
              number: null, // Groups don't have phone numbers
              isAdmin: isAdmin, // Whether current user is admin in this group
              onlyAdminsCanMessage: onlyAdminsCanMessage // Whether group restricts messaging to admins only
            };
          } catch (groupError: any) {
            console.log(`Group processing error for ${group.name}:`, groupError.message);
            return {
              id: group.id._serialized,
              name: group.name,
              description: group.description || '',
              participantCount: 0,
              participants: [],
              timestamp: group.timestamp,
              unreadCount: group.unreadCount,
              lastMessage: null,
              profilePicUrl: null,
              isGroup: true, // Mark as group for proper message routing
              number: null, // Groups don't have phone numbers
              isAdmin: false, // Default to false on error
              onlyAdminsCanMessage: false // Default to false on error
            };
          }
        })
      );

      // Sort groups by latest activity (most recent first)
      const sortedGroups = groupData.sort((a: any, b: any) => {
        // Use lastMessage timestamp if available, otherwise fallback to group timestamp
        const timestampA = Math.max(a.lastMessage?.timestamp || 0, a.timestamp || 0);
        const timestampB = Math.max(b.lastMessage?.timestamp || 0, b.timestamp || 0);
        return timestampB - timestampA; // Latest at top
      });


      
      // Broadcast to WebSocket clients for real-time updates
      this.broadcastToClients('groups_updated', { groups: sortedGroups });
      
      return sortedGroups;
    } catch (error: any) {
      console.error('❌ Failed to fetch groups:', error.message);
      throw error;
    }
  }

  // Method to get specific group participants for detailed view
  async getGroupParticipants(groupId: string): Promise<any[]> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {

      const chat = await this.client.getChatById(groupId);
      
      if (!chat.isGroup) {
        throw new Error('Chat is not a group');
      }

      const participants = chat.participants || [];
      const participantData = participants.map((participant: any) => ({
        id: participant.id._serialized,
        number: participant.id.user,
        isAdmin: participant.isAdmin,
        isSuperAdmin: participant.isSuperAdmin,
        name: null // Will be resolved from contacts
      }));

      console.log(`✅ Retrieved ${participantData.length} participants`);
      return participantData;
    } catch (error: any) {
      console.error('❌ Failed to fetch group participants:', error.message);
      throw error;
    }
  }



  // Helper method to format phone numbers nicely
  private formatPhoneNumber(author: string): string {
    if (typeof author === 'string' && author.includes('@')) {
      const phoneNumber = author.split('@')[0];
      // Format phone number nicely
      if (phoneNumber.length > 7) {
        return phoneNumber.replace(/^(\d{1,3})(\d{3,4})(\d{3,4})(\d{4})$/, '+$1 $2 $3 $4');
      }
      return phoneNumber;
    }
    return author || 'Unknown';
  }

  // Method to preload profile pictures for better UX (called separately to avoid blocking main data load)
  async loadProfilePictures(ids: string[]): Promise<Record<string, string>> {
    if (!this.client || !this.isReady) {
      return {};
    }

    const profilePics: Record<string, string> = {};
    
    // Process in batches to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (id) => {
          try {
            const profilePicUrl = await this.client.getProfilePicUrl(id);
            if (profilePicUrl) {
              profilePics[id] = profilePicUrl;
            }
          } catch (error) {
            // Profile pic not available or private - skip silently
          }
        })
      );
      
      // Small delay between batches
      if (i + batchSize < ids.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return profilePics;
  }
  // Comprehensive data synchronization method
  private async performFullDataSync() {
    if (!this.client || !this.isReady) {
      return;
    }
    
    // ⚡ Fast client verification - reduced wait time
    let attempts = 0;
    const maxAttempts = 3; // Reduced from 10 to 3
    
    while (attempts < maxAttempts) {
      try {
        if (this.client.info && this.client.info.wid) {
          break; // Client is ready
        }
      } catch (e) {
        // Client info not available yet
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 200)); // Reduced from 1000ms to 200ms
    }
    
    try {
      
      // ⚡ Load all data in parallel for maximum speed
      const [chatsResult, contactsResult, groupsResult] = await Promise.allSettled([
        this.syncChats(),
        this.syncContacts(), 
        this.syncGroups()
      ]);
      
      console.log('⚡ Parallel data sync completed:', {
        chats: chatsResult.status,
        contacts: contactsResult.status, 
        groups: groupsResult.status
      });
      

      
    } catch (error: any) {
      // Silent handling
    }
  }

  private async syncChats() {
    try {
      const chats = await this.getChats();
      return chats;
    } catch (error: any) {
      return [];
    }
  }

  private async syncContacts() {
    try {
      const contacts = await this.getContacts();
      return contacts;
    } catch (error: any) {
      return [];
    }
  }

  private async syncGroups() {
    try {
      const groups = await this.getGroups();
      return groups;
    } catch (error: any) {
      return [];
    }
  }

  // Delete a chat completely (for personal chats only)
  async deleteChat(contactId: string): Promise<{ success: boolean; message: string }> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      // Validate that this is not a group chat
      if (contactId.includes('@g.us')) {
        throw new Error('Cannot delete group chats');
      }

      // Get the chat first
      const chat = await this.client.getChatById(contactId);
      
      // Check if chat has delete method available
      if (typeof chat.delete !== 'function') {
        console.log(`⚠️ Chat delete method not available for ${contactId}`);
        throw new Error('Chat deletion is not supported for this chat type');
      }
      
      console.log(`🗑️ Attempting to delete chat ${contactId}...`);
      
      // Try to delete the chat
      try {
        const deleteResult = await chat.delete();
        console.log(`🔍 Delete result:`, deleteResult);
        
        if (deleteResult) {
          // Wait a moment and verify deletion
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Check if chat still exists by trying to fetch it
          try {
            await this.client.getChatById(contactId);
            console.log(`⚠️ Deletion failed - chat still exists`);
            throw new Error('Chat deletion verification failed');
          } catch (e: any) {
            // If getChatById fails, the chat was successfully deleted
            if (e.message.includes('not found') || e.message.includes('does not exist')) {
              console.log(`✅ Chat deletion confirmed - chat no longer exists`);
              
              // Get updated chats list and broadcast it
              const updatedChats = await this.getChatsWithoutBroadcast();
              this.broadcastToClients('chats_updated', { chats: updatedChats });
              
              return { 
                success: true, 
                message: 'Chat deleted successfully' 
              };
            } else {
              throw new Error('Chat deletion verification failed');
            }
          }
        } else {
          throw new Error('Chat deletion returned false');
        }
      } catch (error: any) {
        console.log(`❌ Direct deletion failed:`, error.message);
        
        // Fallback: Archive the chat if deletion doesn't work
        try {
          console.log(`📦 Fallback: Archiving chat ${contactId} instead of deleting...`);
          await chat.archive();
          
          console.log(`✅ Chat ${contactId} archived successfully`);
          
          // Get updated chats list and broadcast it
          const updatedChats = await this.getChatsWithoutBroadcast();
          this.broadcastToClients('chats_updated', { chats: updatedChats });
          
          return { 
            success: true, 
            message: 'Chat archived successfully (WhatsApp Web limitation prevents permanent deletion)' 
          };
        } catch (archiveError: any) {
          console.error(`❌ Fallback archive also failed:`, archiveError.message);
          throw new Error(`Unable to delete or archive chat: ${archiveError.message}`);
        }
      }
    } catch (error: any) {
      console.error(`❌ Failed to delete chat ${contactId}:`, error.message);
      throw error;
    }
  }

  // Clear chat history (for both personal and group chats)
  async clearChatHistory(contactId: string): Promise<{ success: boolean; message: string }> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      // Get the chat and clear all messages
      const chat = await this.client.getChatById(contactId);
      await chat.clearMessages();

      console.log(`✅ Chat history for ${contactId} cleared successfully`);
      
      // Get updated chats list and broadcast it
      const updatedChats = await this.getChatsWithoutBroadcast();
      this.broadcastToClients('chats_updated', { chats: updatedChats });
      this.broadcastToClients('chat_history_cleared', { contactId });
      
      return { 
        success: true, 
        message: 'Chat history cleared successfully' 
      };
    } catch (error: any) {
      console.error(`❌ Failed to clear chat history for ${contactId}:`, error.message);
      throw error;
    }
  }

  // Public method to trigger data sync manually
  async triggerDataSync() {
    if (!this.isReady) {
      throw new Error('WhatsApp client not ready for sync');
    }
    return this.performFullDataSync();
  }
}

export const whatsappService = new WhatsAppService();