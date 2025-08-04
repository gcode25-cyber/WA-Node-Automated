import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg as any;
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

  constructor() {
    this.initializeClient();
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
      console.log('Client already initializing, skipping...');
      return;
    }

    try {
      this.isInitializing = true;
      console.log('🚀 Initializing WhatsApp client...');

      // Clean up existing client
      if (this.client) {
        try {
          await this.client.destroy();
        } catch (e: any) {
          console.log('Old client cleanup (expected):', e.message);
        }
        this.client = null;
      }

      // Reset all state
      this.qrCode = null;
      this.sessionInfo = null;
      this.isReady = false;
      this.messageCache.clear(); // Clear message cache on reinitialize

      // Use full puppeteer with proper configuration to fix execution context issues
      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: "main_session", // Persistent session ID for session preservation
          dataPath: "./.wwebjs_auth" // Explicit data path
        }),
        puppeteer: {
          headless: true,
          executablePath: '/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            `--user-data-dir=/tmp/chrome-${Date.now()}-${Math.random().toString(36).substring(7)}`
          ],
          handleSIGINT: false,
          handleSIGTERM: false,
          handleSIGHUP: false
        }
      });

      // Event handlers
      this.client.on('qr', (qr: string) => {
        console.log('📱 New QR Code received from WhatsApp Web');
        console.log('🔍 QR String type:', typeof qr);
        console.log('🔍 QR String length:', qr.length);
        console.log('🔍 QR String preview:', qr.substring(0, 120) + '...');
        
        try {
          const qrBuffer = qrImage.image(qr, { type: 'png' });
          let qrDataURL = 'data:image/png;base64,';
          qrDataURL += Buffer.from(qrBuffer).toString('base64');
          
          this.qrCode = qrDataURL;
          console.log('✅ QR Code generated successfully with qr-image');
          
          // Broadcast QR code to all connected WebSocket clients
          this.broadcastToClients('qr', { qr: qrDataURL });
        } catch (qrError: any) {
          console.error('❌ QR generation failed:', qrError.message);
          this.qrCode = null;
        }
      });

      this.client.on('ready', () => {
        console.log('✅ WhatsApp client is ready!');
        this.isReady = true;
        this.sessionInfo = {
          number: this.client.info?.wid?.user || 'unknown',
          name: this.client.info?.pushname || 'unknown',
          loginTime: new Date().toISOString()
        };
        
        // Broadcast connection status
        this.broadcastToClients('connected', { 
          connected: true, 
          sessionInfo: this.sessionInfo 
        });
      });

      this.client.on('authenticated', () => {
        console.log('🔐 WhatsApp client authenticated');
      });

      this.client.on('auth_failure', (msg: any) => {
        console.error('❌ Authentication failed:', msg);
        this.isReady = false;
        this.sessionInfo = null;
      });

      this.client.on('disconnected', (reason: any) => {
        console.log('🔌 WhatsApp client disconnected:', reason);
        this.isReady = false;
        this.sessionInfo = null;
        this.qrCode = null;
        
        // Broadcast disconnection
        this.broadcastToClients('disconnected', { connected: false, reason });
      });

      // Real-time message handling
      this.client.on('message', (message: any) => {
        this.storeRealtimeMessage(message);
      });

      console.log('✅ Starting client initialization...');
      await this.client.initialize();

    } catch (error: any) {
      console.error('❌ WhatsApp client initialization failed:', error.message);
      this.isReady = false;
      this.sessionInfo = null;
      this.qrCode = null;
      console.log('Browser failed to initialize - QR will be available when browser starts');
    } finally {
      this.isInitializing = false;
    }
  }

  async logout(): Promise<void> {
    try {
      console.log('🔌 Starting comprehensive logout process...');
      
      // Clear session info first
      this.sessionInfo = null;
      this.qrCode = null;
      this.isReady = false;
      this.isInitializing = false;
      this.messageCache.clear();
      
      // Clear storage
      await storage.clearAllSessions();
      
      // Enhanced logout with phone disconnection
      if (this.client) {
        try {
          console.log('🎯 Attempting comprehensive logout with phone disconnection...');
          
          // Method 1: Try to access the puppeteer page for UI-based logout
          try {
            const page = await this.client.pupPage;
            if (page) {
              console.log('📱 Executing UI-based logout to disconnect phone...');
              
              // Try to click the menu and logout
              await page.evaluate(() => {
                try {
                  // Look for menu button and click it
                  const menuBtn = document.querySelector("span[data-icon='menu']");
                  if (menuBtn) {
                    (menuBtn as HTMLElement).click();
                    
                    // Wait a bit then look for logout
                    setTimeout(() => {
                      const logoutElements = Array.from(document.querySelectorAll('div')).filter(
                        el => el.textContent?.includes('Log out')
                      );
                      if (logoutElements.length > 0) {
                        (logoutElements[0] as HTMLElement).click();
                        
                        // Handle confirmation if it appears
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
              
              console.log('✅ UI logout attempt completed');
              await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for logout to process
            }
          } catch (pageError: any) {
            console.log('Page access failed:', pageError.message);
          }
          
          // Method 2: Standard client logout
          try {
            await this.client.logout();
            console.log('✅ Client logout successful');
          } catch (logoutError: any) {
            console.log('Client logout (expected):', logoutError.message);
          }
          
          // Method 3: Destroy client
          console.log('🧹 Destroying WhatsApp client...');
          await this.client.destroy();
          console.log('✅ Client destroyed');
          
        } catch (clientError: any) {
          console.log('Client operation failed:', clientError.message);
        }
        
        this.client = null;
      }
      
      // Clear session files manually
      try {
        const fs = await import('fs');
        const path = await import('path');
        const sessionPath = path.resolve('./.wwebjs_auth');
        
        if (fs.existsSync(sessionPath)) {
          console.log('🗑️ Removing session files to force phone disconnect...');
          fs.rmSync(sessionPath, { recursive: true, force: true });
          console.log('✅ Session files cleared - phone should disconnect');
        }
        
        // Clear Chrome user data directories
        const tmpDir = '/tmp';
        try {
          const chromeDataDirs = fs.readdirSync(tmpDir).filter(dir => dir.startsWith('chrome-'));
          for (const dir of chromeDataDirs) {
            try {
              fs.rmSync(path.join(tmpDir, dir), { recursive: true, force: true });
              console.log(`🗑️ Cleared Chrome data: ${dir}`);
            } catch (e) {
              // Non-critical cleanup
            }
          }
        } catch (e) {
          // Non-critical
        }
      } catch (fsError: any) {
        console.log('Session file cleanup (non-critical):', fsError.message);
      }
      
      console.log('✅ Logout successful - reinitializing for new QR');
      
      // Broadcast logout event to clients
      this.broadcastToClients('logout', { connected: false });
      
      // Reinitialize with delay for proper cleanup
      setTimeout(() => {
        this.initializeClient();
      }, 2000);
      
    } catch (error: any) {
      console.error('❌ Logout failed:', error.message);
      throw error;
    }
  }

  // ... rest of the methods remain the same as before ...
  
  async getQRCode(): Promise<string | null> {
    return this.qrCode;
  }

  async forceRefreshQR() {
    console.log('🔄 Force refreshing QR code by reinitializing client...');
    this.qrCode = null;
    this.sessionInfo = null;
    
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (e: any) {
        console.log('Client cleanup during force refresh:', e?.message);
      }
    }
    this.client = null;
    
    await this.initializeClient();
  }

  async getSessionInfo() {
    if (this.sessionInfo) {
      return this.sessionInfo;
    } else {
      return null;
    }
  }

  async isClientReady(): Promise<boolean> {
    return this.isReady;
  }

  async sendMessage(phoneNumber: string, message: string): Promise<any> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      // Format phone number properly
      let formattedNumber = phoneNumber.replace(/\D/g, '');
      
      if (formattedNumber.startsWith('1')) {
        formattedNumber = formattedNumber;
      } else if (formattedNumber.length === 10) {
        formattedNumber = '1' + formattedNumber;
      }
      
      const chatId = formattedNumber + '@c.us';
      
      console.log(`📤 Sending message to ${formattedNumber}: ${message.substring(0, 50)}...`);
      
      const result = await this.client.sendMessage(chatId, message);
      
      console.log('✅ Message sent successfully');
      return result;
      
    } catch (error: any) {
      console.error('❌ Failed to send message:', error.message);
      throw error;
    }
  }

  private async storeRealtimeMessage(message: any) {
    try {
      if (!message) return;
      
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
        to: message.to || contactId
      };
      
      messages.push(messageData);
      
      // Keep only last 100 messages per contact
      if (messages.length > 100) {
        messages = messages.slice(-100);
      }
      
      // Update cache
      this.messageCache.set(contactId, messages);
      
    } catch (error: any) {
      console.error('Failed to store realtime message:', error.message);
    }
  }
}

export const whatsappService = new WhatsAppService();