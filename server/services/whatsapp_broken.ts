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
          headless: true, // Must be headless in cloud environment
          slowMo: 100, // Slow down operations for stability
          executablePath: '/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-blink-features=AutomationControlled',
            '--disable-extensions',
            '--disable-ipc-flooding-protection',
            `--user-data-dir=/tmp/chrome-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            '--disable-session-crashed-bubble',
            '--disable-infobars',
            '--force-no-sandbox',
            '--remote-debugging-port=0'
          ],
        },
      });

      this.setupEventHandlers();
      
      console.log('✅ Starting client initialization...');
      await this.client.initialize();
    } catch (error) {
      console.error('❌ Failed to initialize WhatsApp client:', error);
      this.isInitializing = false;
      this.client = null;
      
      console.log('Browser failed to initialize - QR will be available when browser starts');
      
      // Retry initialization after delay
      setTimeout(() => {
        console.log('🔄 Retrying client initialization...');
        this.initializeClient();
      }, 3000);
    }
  }

  private setupEventHandlers() {
    if (!this.client) return;

    this.client.on('qr', async (qrString: string) => {
      console.log('📱 New QR Code received from WhatsApp Web');
      console.log('🔍 QR String type:', typeof qrString);
      console.log('🔍 QR String length:', qrString.length);
      console.log('🔍 QR String preview:', qrString.substring(0, 100) + '...');
      
      // Check if qrString is already a base64 data URL (WhatsApp Web sometimes provides this)
      if (qrString.startsWith('data:image/')) {
        console.log('✅ QR Code already in base64 format from WhatsApp Web');
        this.qrCode = qrString;
        this.broadcastToClients('qr', { qr: this.qrCode });
      } else {
        // Try to generate QR code from the string
        try {
          // Use qr-image library directly since it handles large data better
          const qrBuffer = qrImage.imageSync(qrString, { 
            type: 'png', 
            size: 20, // Larger size for better scanning
            margin: 2,
            ec_level: 'L' // Low error correction for maximum data capacity
          });
          this.qrCode = `data:image/png;base64,${qrBuffer.toString('base64')}`;
          console.log('✅ QR Code generated successfully with qr-image');
          this.broadcastToClients('qr', { qr: this.qrCode });
        } catch (err) {
          console.error('QR image generation failed:', err);
          // Last resort: store the raw string and let client handle it
          this.qrCode = qrString;
          this.broadcastToClients('qr', { qr: null, rawQr: qrString });
        }
      }
      this.sessionInfo = null;
    });

    this.client.on('ready', async () => {
      console.log('WhatsApp client is ready');
      this.isReady = true;
      this.isInitializing = false;
      this.qrCode = null;
      
      // Broadcast session connected event
      this.broadcastToClients('connected', { connected: true });
      
      // Multiple attempts to get user info with different delays
      const getUserInfo = async (attempt = 1) => {
        try {
          if (this.client && this.client.info) {
            const info = this.client.info;
            const userName = info.pushname || info.wid?.user || "Unknown User";
            
            this.sessionInfo = {
              name: userName,
              loginTime: this.sessionInfo?.loginTime || new Date().toISOString(),
              isFirstConnection: false // Existing session, not first connection
            };
            
            await storage.clearAllSessions();
            await storage.createSession({
              userId: info.wid?.user || 'unknown',
              userName: userName,
              loginTime: new Date(),
              sessionData: JSON.stringify({ wid: info.wid }),
            });
            console.log('✅ Session saved for user:', userName);
            this.qrCode = null;
            return;
          }
          
          // Fallback to use session-based name
          const userName = "Connected User";
          this.sessionInfo = {
            name: userName,
            loginTime: this.sessionInfo?.loginTime || new Date().toISOString(),
            isFirstConnection: false // Existing session, not first connection
          };
          
          await storage.clearAllSessions();
          await storage.createSession({
            userId: 'fallback-user',
            userName: userName,
            loginTime: new Date(),
            sessionData: JSON.stringify({ fallback: true }),
          });
          console.log('✅ Session saved for user:', userName);
          this.qrCode = null;
        } catch (error: any) {
          console.error(`⚠️ Attempt ${attempt} - Error loading user info:`, error.message);
          
          // Retry with increasing delays, max 3 attempts
          if (attempt < 3) {
            setTimeout(() => getUserInfo(attempt + 1), attempt * 2000);
          } else {
            // Fallback to authenticated user without detailed info
            this.sessionInfo = {
              name: "WhatsApp User",
              loginTime: this.sessionInfo?.loginTime || new Date().toISOString(),
              isFirstConnection: false // Fallback session, not first connection
            };
            console.log('Using fallback user info');
          }
        }
      };
      
      // Start first attempt after 2 seconds
      setTimeout(() => getUserInfo(1), 2000);
    });

    this.client.on('authenticated', () => {
      console.log('WhatsApp client authenticated');
      this.qrCode = null;
      this.sessionInfo = {
        name: "Fetching...",
        loginTime: new Date().toISOString(),
        isFirstConnection: true // Mark as first connection for auto-redirect
      };
    });

    this.client.on('auth_failure', (msg: any) => {
      console.error('WhatsApp authentication failed:', msg);
      this.qrCode = null;
      this.isReady = false;
    });

    this.client.on('disconnected', (reason: any) => {
      console.log('🔌 Client disconnected:', reason);
      this.isReady = false;
      this.qrCode = null;
      this.sessionInfo = null;
      this.messageCache.clear(); // Clear cached messages on disconnect
      storage.clearAllSessions();
      
      // Broadcast disconnection event
      this.broadcastToClients('disconnected', { connected: false });
      
      // Reinitialize client on disconnect with delay
      setTimeout(() => {
        this.initializeClient();
      }, 2000);
    });

    // Listen for incoming messages in real-time
    this.client.on('message', async (message: any) => {
      try {
        console.log('📥 New message received:', {
          from: message.from,
          body: message.body || '[Media]',
          timestamp: message.timestamp,
          fromMe: message.fromMe
        });
        
        // Store the message in memory for immediate retrieval
        await this.storeRealtimeMessage(message);
      } catch (error: any) {
        console.error('Error handling incoming message:', error.message);
      }
    });

    // Listen for message acks (delivered, read, etc.)
    this.client.on('message_ack', (msg: any, ack: any) => {
      console.log('📧 Message ACK received:', {
        messageId: msg.id?._serialized,
        ack: ack // 1: sent, 2: received, 3: read, 4: played
      });
    });

    // Listen for group join events
    this.client.on('group_join', (notification: any) => {
      console.log('👥 Group join event:', notification);
    });

    // Listen for group leave events  
    this.client.on('group_leave', (notification: any) => {
      console.log('👋 Group leave event:', notification);
    });

    // Listen for remote session logout (when user logs out from phone)
    this.client.on('remote_session_saved', () => {
      console.log('📱 Remote session saved');
    });

    // Listen for logout events from phone
    this.client.on('logout', () => {
      console.log('📱 Logout detected from phone');
      this.handleLogout();
    });

    // Listen for authentication failure (also triggered by logout from phone)
    this.client.on('auth_failure', (message: any) => {
      console.log('🔐 Authentication failure:', message);
      if (message === 'LOGOUT') {
        this.handleLogout();
      }
    });
  }

  // Handle logout from phone or authentication failure
  private handleLogout() {
    console.log('🔥 Handling logout event...');
    
    // Clear all session data
    this.sessionInfo = null;
    this.qrCode = null;
    this.isReady = false;
    this.messageCache.clear();
    
    // Clear storage
    storage.clearAllSessions();
    
    // Broadcast logout event to all connected clients
    this.broadcastToClients('logout', { 
      reason: 'Phone disconnected or user logged out',
      timestamp: new Date().toISOString()
    });
    
    // Re-initialize client to generate new QR code
    setTimeout(() => {
      console.log('🔄 Re-initializing client after logout...');
      this.initializeClient();
    }, 1000);
  }

  async getQRCode(): Promise<string | null> {
    // Simply return the current QR code without forcing refresh
    return this.qrCode;
  }

  async forceRefreshQR(): Promise<void> {
    console.log('🔄 Force refreshing QR code by reinitializing client...');
    
    // Always reset state to force fresh initialization
    this.isInitializing = false;
    this.isReady = false;
    this.sessionInfo = null;
    this.qrCode = null;
    
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (e: any) {
        console.log('Client cleanup during force refresh:', e?.message);
      }
    }
    this.client = null;
    
    // Force re-initialization regardless of current state
    await this.initializeClient();
  }

  async getSessionInfo() {
    if (this.sessionInfo) {
      return this.sessionInfo;
    } else {
      return null;
    }
  }



  async logout(): Promise<void> {
    try {
      console.log('🔌 Starting logout process...');
      
      // Clear session info first
      this.sessionInfo = null;
      this.qrCode = null;
      this.isReady = false;
      this.isInitializing = false;
      this.messageCache.clear(); // Clear cached messages on logout
      
      // Clear storage
      await storage.clearAllSessions();
      
      // Properly destroy client and logout from WhatsApp Web
      if (this.client) {
        try {
          console.log('🧹 Logging out from WhatsApp Web and disconnecting phone...');
          
          // Method 1: Try UI-based logout to properly notify phone
          try {
            console.log('🎯 Attempting real UI logout to disconnect phone...');
            const page = await this.client.pupPage;
            
            if (page) {
              // Wait for page to be ready
              await page.waitForSelector('body', { timeout: 5000 });
              
              // Method 1a: Refined UI logout with proper timing and confirmation handling
              try {
                console.log('📱 Starting refined UI logout process...');
                
                // Take screenshot before logout for debugging
                try {
                  await page.screenshot({ path: './logout-before.png' });
                  console.log('📸 Screenshot taken: logout-before.png');
                } catch (screenshotErr) {
                  console.log('Screenshot failed (non-critical):', screenshotErr.message);
                }
                
                // Step 1: Inspect page and click menu button with network monitoring
                console.log('🔍 Enabling network monitoring...');
                await page.setRequestInterception(true);
                
                // Monitor network requests for logout calls
                page.on('request', (request) => {
                  if (request.url().includes('logout') || request.url().includes('disconnect')) {
                    console.log('🌐 Network request detected:', request.method(), request.url());
                  }
                  request.continue();
                });
                
                page.on('response', (response) => {
                  if (response.url().includes('logout') || response.url().includes('disconnect')) {
                    console.log('🌐 Network response:', response.status(), response.url());
                  }
                });
                
                console.log('🔍 Looking for menu button...');
                await page.waitForSelector("span[data-icon='menu']", { timeout: 5000 });
                
                // Log available elements for debugging
                const menuElements = await page.$$("span[data-icon='menu']");
                console.log(`📊 Found ${menuElements.length} menu elements`);
                
                await page.click("span[data-icon='menu']");
                console.log('✅ Clicked menu button');
                
                // Step 2: Wait for menu to fully load
                await page.waitForTimeout(2000);
                
                // Step 3: Comprehensive logout button detection
                console.log('🔍 Analyzing menu structure...');
                
                // Get all text content in the menu to debug
                const menuText = await page.evaluate(() => {
                  const menuElements = document.querySelectorAll('[role="menu"], [data-testid="menu"], div[tabindex]');
                  return Array.from(menuElements).map(el => ({
                    text: el.textContent,
                    classes: el.className,
                    visible: el.offsetParent !== null
                  }));
                });
                console.log('📋 Menu content found:', JSON.stringify(menuText, null, 2));
                
                // Try multiple logout detection strategies
                const logoutStrategies = [
                  "//div[contains(text(), 'Log out') and not(ancestor::div[contains(@style, 'display: none')])]",
                  "//span[contains(text(), 'Log out')]",
                  "//div[@role='button'][contains(text(), 'Log out')]",
                  "[data-testid*='logout']",
                  "//div[text()='Log out']"
                ];
                
                let logoutBtn = null;
                let usedStrategy = '';
                
                for (const strategy of logoutStrategies) {
                  try {
                    console.log(`🎯 Trying strategy: ${strategy}`);
                    if (strategy.startsWith('//')) {
                      await page.waitForXPath(strategy, { timeout: 2000 });
                      const elements = await page.$x(strategy);
                      if (elements.length > 0) {
                        logoutBtn = elements[0];
                        usedStrategy = strategy;
                        console.log(`✅ Found logout button with: ${strategy}`);
                        break;
                      }
                    } else {
                      await page.waitForSelector(strategy, { timeout: 2000 });
                      const element = await page.$(strategy);
                      if (element) {
                        logoutBtn = element;
                        usedStrategy = strategy;
                        console.log(`✅ Found logout button with: ${strategy}`);
                        break;
                      }
                    }
                  } catch (strategyErr) {
                    console.log(`❌ Strategy failed: ${strategy}`);
                  }
                }
                
                try {
                  
                  if (logoutBtn) {
                    console.log(`🎯 Clicking logout button found with: ${usedStrategy}`);
                    
                    // Monitor network before clicking
                    const networkRequests = [];
                    page.on('request', (req) => networkRequests.push(req.url()));
                    
                    await logoutBtn.click();
                    console.log('✅ Clicked initial logout button');
                    
                    // Wait and check for network activity
                    await page.waitForTimeout(1000);
                    const logoutRequests = networkRequests.filter(url => 
                      url.includes('logout') || url.includes('disconnect') || url.includes('terminate')
                    );
                    console.log('🌐 Logout-related network requests:', logoutRequests);
                    
                    // Take screenshot after clicking logout
                    try {
                      await page.screenshot({ path: './logout-after-click.png' });
                      console.log('📸 Screenshot taken: logout-after-click.png');
                    } catch (screenshotErr) {
                      console.log('Screenshot failed (non-critical):', screenshotErr.message);
                    }
                    
                    // Step 4: Wait for and handle confirmation dialog
                    console.log('🔍 Waiting for confirmation dialog...');
                    await page.waitForTimeout(2000);
                    
                    // Enhanced confirmation dialog handling
                    console.log('🔍 Searching for confirmation dialog...');
                    
                    // Check for modal/dialog presence first
                    const dialogSelectors = [
                      "[role='dialog']",
                      ".modal",
                      "[data-testid*='modal']",
                      "[data-testid*='dialog']"
                    ];
                    
                    let dialogFound = false;
                    for (const selector of dialogSelectors) {
                      try {
                        await page.waitForSelector(selector, { timeout: 2000 });
                        dialogFound = true;
                        console.log(`✅ Found dialog with: ${selector}`);
                        break;
                      } catch (e) {
                        // Continue to next selector
                      }
                    }
                    
                    if (dialogFound) {
                      // Try multiple confirmation strategies
                      const confirmStrategies = [
                        "//div[contains(text(), 'Log out') and ancestor::div[@role='dialog']]",
                        "//button[contains(text(), 'Log out')]",
                        "//div[@role='button'][contains(text(), 'Log out')]",
                        "[data-testid='popup-controls-ok']",
                        "//div[text()='Log out' and ancestor::*[@role='dialog']]"
                      ];
                      
                      let confirmClicked = false;
                      for (const strategy of confirmStrategies) {
                        try {
                          console.log(`🎯 Trying confirm strategy: ${strategy}`);
                          if (strategy.startsWith('//')) {
                            const elements = await page.$x(strategy);
                            if (elements.length > 0) {
                              await elements[0].click();
                              console.log(`✅ Confirmed logout with: ${strategy}`);
                              confirmClicked = true;
                              break;
                            }
                          } else {
                            const element = await page.$(strategy);
                            if (element) {
                              await element.click();
                              console.log(`✅ Confirmed logout with: ${strategy}`);
                              confirmClicked = true;
                              break;
                            }
                          }
                        } catch (strategyErr) {
                          console.log(`❌ Confirm strategy failed: ${strategy}`);
                        }
                      }
                      
                      if (confirmClicked) {
                        console.log('🎉 LOGOUT CONFIRMATION CLICKED - Phone should disconnect!');
                        
                        // Take final screenshot
                        try {
                          await page.screenshot({ path: './logout-confirmed.png' });
                          console.log('📸 Screenshot taken: logout-confirmed.png');
                        } catch (screenshotErr) {
                          console.log('Screenshot failed (non-critical):', screenshotErr.message);
                        }
                        
                        // Wait and monitor for logout completion
                        await page.waitForTimeout(5000);
                        
                        // Check if we're redirected to login page
                        const currentUrl = page.url();
                        console.log('🌐 Current URL after logout:', currentUrl);
                        
                      } else {
                        console.log('⚠️ Could not click confirmation - manual fallback needed');
                      }
                    } else {
                      console.log('⚠️ No confirmation dialog found - logout may be direct');
                    }
                      
                    } catch (confirmWaitErr) {
                      console.log('⚠️ Confirmation dialog timeout - trying alternative selectors');
                      
                      // Fallback: try other confirmation selectors
                      const altConfirmSelectors = [
                        "//button[contains(text(), 'Log out')]",
                        "//div[@role='button'][contains(text(), 'Log out')]",
                        "[data-testid='popup-controls-ok']"
                      ];
                      
                      for (const selector of altConfirmSelectors) {
                        try {
                          if (selector.startsWith('//')) {
                            const [element] = await page.$x(selector);
                            if (element) {
                              await element.click();
                              console.log(`✅ Confirmed logout using: ${selector}`);
                              break;
                            }
                          } else {
                            const element = await page.$(selector);
                            if (element) {
                              await element.click();
                              console.log(`✅ Confirmed logout using: ${selector}`);
                              break;
                            }
                          }
                        } catch (altErr) {
                          console.log(`Alternative selector ${selector} failed`);
                        }
                      }
                    }
                    
                  } else {
                    console.log('❌ Logout button not found in menu');
                  }
                  
                } catch (logoutWaitErr) {
                  console.log('❌ Logout button wait timeout:', logoutWaitErr.message);
                }
                
              } catch (menuErr) {
                console.log('Menu-based logout failed:', menuErr.message);
                
                // Fallback: Try JavaScript evaluation to trigger internal logout
                try {
                  console.log('🔄 Attempting JavaScript-based logout...');
                  await page.evaluate(() => {
                    // Try to find WhatsApp's internal logout functions
                    const possibleLogoutMethods = [
                      'window.Store?.AppState?.logout',
                      'window.Store?.State?.default?.logout', 
                      'window.WA?.logout',
                      'window.WAWeb?.logout'
                    ];
                    
                    for (const methodPath of possibleLogoutMethods) {
                      try {
                        const method = eval(methodPath);
                        if (typeof method === 'function') {
                          console.log('Found logout method:', methodPath);
                          method();
                          return true;
                        }
                      } catch (e) {
                        // Continue to next method
                      }
                    }
                    
                    // Alternative: Try to trigger logout event
                    try {
                      const event = new CustomEvent('logout');
                      document.dispatchEvent(event);
                      window.dispatchEvent(event);
                    } catch (e) {
                      console.log('Event dispatch failed');
                    }
                    
                    return false;
                  });
                  console.log('✅ JavaScript logout attempt completed');
                } catch (jsErr) {
                  console.log('JavaScript logout failed:', jsErr.message);
                }
                
                // Final fallback to programmatic logout
                await this.client.logout();
              }
            } else {
              console.log('No page available, using programmatic logout');
              await this.client.logout();
            }
            
          } catch (logoutErr) {
            console.log('All logout methods failed, trying client.logout():', logoutErr.message);
            try {
              await this.client.logout();
            } catch (finalErr) {
              console.log('Final logout attempt failed:', finalErr.message);
            }
          }
          
          // Method 2: Clear browser storage and IndexedDB aggressively
          try {
            const page = await this.client.pupPage;
            if (page) {
              await page.evaluate(() => {
                try {
                  // Clear WhatsApp-specific IndexedDB
                  if (window.indexedDB && window.indexedDB.databases) {
                    window.indexedDB.databases().then(databases => {
                      databases.forEach(db => {
                        if (db.name && (db.name.includes('wawc') || db.name.includes('whatsapp'))) {
                          window.indexedDB.deleteDatabase(db.name);
                          console.log('Deleted IndexedDB:', db.name);
                        }
                      });
                    });
                  }
                  
                  // Clear all storage
                  localStorage.clear();
                  sessionStorage.clear();
                  
                  // Clear specific WhatsApp storage keys
                  const keysToRemove = ['WASecretBundle', 'WAToken1', 'WAToken2', 'WABrowserId'];
                  keysToRemove.forEach(key => {
                    try {
                      localStorage.removeItem(key);
                      sessionStorage.removeItem(key);
                    } catch (e) {}
                  });
                  
                  console.log('Storage and IndexedDB cleared');
                } catch (storageErr) {
                  console.log('Storage cleanup error:', storageErr);
                }
              });
              
              // Delete browser cookies
              try {
                const cookies = await page.cookies();
                if (cookies.length > 0) {
                  await page.deleteCookie(...cookies);
                  console.log('✅ Cleared browser cookies');
                }
              } catch (cookieErr) {
                console.log('Cookie cleanup error:', cookieErr.message);
              }
              
              console.log('✅ Aggressive storage cleanup completed');
            }
          } catch (storageErr) {
            console.log('Storage cleanup method failed:', storageErr.message);
          }
          
          console.log('🧹 Destroying WhatsApp client...');
          await this.client.destroy();
          console.log('✅ Client destroyed');
        } catch (clientError: any) {
          console.log('Client logout/destruction (expected):', clientError?.message);
        }
        this.client = null;
      }
      
      // Clear session files manually to ensure complete logout and force phone disconnect
      try {
        const fs = await import('fs');
        const path = await import('path');
        const sessionPath = path.resolve('./.wwebjs_auth');
        
        if (fs.existsSync(sessionPath)) {
          console.log('🗑️ Removing session files to force phone disconnect...');
          fs.rmSync(sessionPath, { recursive: true, force: true });
          console.log('✅ Session files cleared - phone should disconnect');
        }
        
        // Also clear any Chrome user data directories to ensure clean slate
        const tmpDir = '/tmp';
        const chromeDataDirs = fs.readdirSync(tmpDir).filter(dir => dir.startsWith('chrome-'));
        for (const dir of chromeDataDirs) {
          try {
            fs.rmSync(path.join(tmpDir, dir), { recursive: true, force: true });
            console.log(`🗑️ Cleared Chrome data: ${dir}`);
          } catch (e) {
            // Non-critical cleanup
          }
        }
      } catch (fsError: any) {
        console.log('Session file cleanup (non-critical):', fsError?.message);
      }
      
      console.log('✅ Logout successful - reinitializing for new QR');
      
      // Broadcast logout event to clients immediately
      this.broadcastToClients('logout', { connected: false });
      
      // Immediate reinitialize with slight delay to ensure cleanup is complete
      setTimeout(() => {
        this.initializeClient();
      }, 2000); // Increased delay to ensure proper cleanup
      
    } catch (error) {
      console.error('❌ Logout error:', error);
      // Force clean state even on error
      this.sessionInfo = null;
      this.qrCode = null;
      this.isReady = false;
      this.isInitializing = false;
      this.client = null;
      this.messageCache.clear(); // Clear cache on error too
      
      // Force clear session files even on error
      try {
        const fs = await import('fs');
        const path = await import('path');
        const sessionPath = path.resolve('./.wwebjs_auth');
        if (fs.existsSync(sessionPath)) {
          fs.rmSync(sessionPath, { recursive: true, force: true });
          console.log('🗑️ Force cleared session files after error');
        }
      } catch (fsError: any) {
        console.log('Force session cleanup failed (non-critical):', fsError?.message);
      }
      
      // Still try to reinitialize
      setTimeout(() => {
        console.log('🔄 Force reinitializing after logout error...');
        this.initializeClient();
      }, 2500);
    }
  }

  isClientReady(): boolean {
    return this.isReady;
  }



  async simulateLogin() {
    try {
      // Create a demo session for UI testing
      this.sessionInfo = {
        name: 'Demo User',
        loginTime: new Date().toISOString()
      };
      this.isReady = true;
      this.qrCode = null;
      console.log('Demo login simulated successfully');
    } catch (error) {
      console.error('Failed to simulate login:', error);
      throw error;
    }
  }



  async sendMessage(phoneNumber: string, message: string) {
    try {
      if (!this.client || !this.isReady) {
        throw new Error('WhatsApp client is not ready. Please connect first.');
      }

      // Handle group IDs vs phone numbers
      let chatId: string;
      if (phoneNumber.includes('@g.us')) {
        // This is a group ID, use as is
        chatId = phoneNumber;
      } else if (phoneNumber.includes('@c.us')) {
        // This is already a properly formatted chat ID
        chatId = phoneNumber;
      } else {
        // Clean phone number - remove all non-digits
        const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');
        
        // Validate phone number
        if (!cleanPhoneNumber || cleanPhoneNumber.length < 10) {
          throw new Error('Please enter a valid phone number');
        }
        
        // Format for WhatsApp (add @c.us suffix)
        chatId = `${cleanPhoneNumber}@c.us`;
      }

      console.log(`Sending message to ${chatId}: ${message}`);

      // Check if the number is registered on WhatsApp first
      try {
        const isRegistered = await this.client.isRegisteredUser(chatId);
        if (!isRegistered) {
          throw new Error('This phone number is not registered on WhatsApp');
        }
      } catch (checkError) {
        console.log('Could not verify registration, proceeding with send...');
      }

      // Send message with retry logic
      let sentMessage;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          sentMessage = await this.client.sendMessage(chatId, message);
          break;
        } catch (sendError: any) {
          if (attempt === 3) throw sendError;
          console.log(`Send attempt ${attempt} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
      
      if (!sentMessage) {
        throw new Error('Failed to send message after multiple attempts');
      }
      
      console.log('Message sent successfully:', sentMessage.id);
      
      return {
        messageId: sentMessage.id,
        timestamp: new Date().toISOString(),
        to: phoneNumber,
        message: message
      };
    } catch (error: any) {
      console.error('Failed to send message:', error);
      throw new Error(`Failed to send message: ${error.message || 'Unknown error'}`);
    }
  }

  async sendMediaMessage(phoneNumber: string, message: string | undefined, filePath: string, fileName: string) {
    try {
      if (!this.client || !this.isReady) {
        throw new Error('WhatsApp client is not ready. Please connect first.');
      }

      // Handle group IDs vs phone numbers
      let chatId: string;
      if (phoneNumber.includes('@g.us')) {
        // This is a group ID, use as is
        chatId = phoneNumber;
      } else if (phoneNumber.includes('@c.us')) {
        // This is already a properly formatted chat ID
        chatId = phoneNumber;
      } else {
        // Clean phone number - remove all non-digits
        const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');
        
        // Validate phone number
        if (!cleanPhoneNumber || cleanPhoneNumber.length < 10) {
          throw new Error('Please enter a valid phone number');
        }
        
        // Format for WhatsApp (add @c.us suffix)
        chatId = `${cleanPhoneNumber}@c.us`;
      }


      console.log(`Sending media message to ${chatId}:`, fileName);

      // Check if the number is registered on WhatsApp first
      try {
        const isRegistered = await this.client.isRegisteredUser(chatId);
        if (!isRegistered) {
          throw new Error('This phone number is not registered on WhatsApp');
        }
      } catch (checkError) {
        console.log('Could not verify registration, proceeding with send...');
      }

      // Create MessageMedia from file with proper MIME type detection
      const media = MessageMedia.fromFilePath(filePath);
      
      // Set filename for proper display
      if (fileName) {
        media.filename = fileName;
      }
      
      // Comprehensive MIME type detection for all WhatsApp supported formats
      const fileExtension = path.extname(fileName || filePath).toLowerCase();
      
      // All WhatsApp supported file formats with proper MIME types
      const supportedMimeTypes = {
        // Images
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.tiff': 'image/tiff',
        '.tif': 'image/tiff',
        
        // Videos
        '.mp4': 'video/mp4',
        '.mkv': 'video/x-matroska',
        '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime',
        '.3gp': 'video/3gpp',
        '.m4v': 'video/x-m4v',
        '.webm': 'video/webm',
        '.3g2': 'video/3gpp2',
        '.rmvb': 'video/vnd.rn-realvideo',
        
        // Audio
        '.aac': 'audio/aac',
        '.amr': 'audio/amr',
        '.flac': 'audio/flac',
        '.m4a': 'audio/mp4',
        '.m4r': 'audio/mp4',
        '.mp3': 'audio/mpeg',
        '.ogg': 'audio/ogg',
        '.wav': 'audio/wav',
        '.wma': 'audio/x-ms-wma',
        
        // Documents
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.txt': 'text/plain',
        '.html': 'text/html',
        '.epub': 'application/epub+zip',
        '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
        '.zip': 'application/zip',
        '.json': 'application/json'
      };
      
      // Set proper MIME type for all supported formats
      const mimeType = supportedMimeTypes[fileExtension as keyof typeof supportedMimeTypes];
      if (mimeType) {
        media.mimetype = mimeType;
        console.log(`Setting MIME type for ${fileExtension}: ${media.mimetype}`);
      } else {
        console.log(`Using default MIME type for unsupported extension: ${fileExtension}`);
      }
      
      // Validate file size according to WhatsApp limits
      const stats = fs.statSync(filePath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      
      // Check file size limits based on type
      const isVideo = fileExtension.match(/\.(mp4|mkv|avi|mov|3gp|m4v|webm|3g2|rmvb)$/);
      const isDocument = fileExtension.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|html|epub|ods|zip|json)$/);
      
      if (isVideo && fileSizeInMB > 16) {
        throw new Error(`Video file is too large (${fileSizeInMB.toFixed(1)}MB). WhatsApp supports videos up to 16MB.`);
      } else if (isDocument && fileSizeInMB > 100) {
        throw new Error(`Document file is too large (${fileSizeInMB.toFixed(1)}MB). WhatsApp supports documents up to 100MB.`);
      } else if (fileSizeInMB > 100) {
        throw new Error(`File is too large (${fileSizeInMB.toFixed(1)}MB). Maximum file size is 100MB.`);
      }
      
      console.log(`File size: ${fileSizeInMB.toFixed(2)}MB - within WhatsApp limits`);

      // Send media message with retry logic
      let sentMessage;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          if (message && message.trim()) {
            // Send media with caption
            sentMessage = await this.client.sendMessage(chatId, media, { caption: message.trim() });
          } else {
            // Send media without caption
            sentMessage = await this.client.sendMessage(chatId, media);
          }
          break;
        } catch (sendError: any) {
          if (attempt === 3) throw sendError;
          console.log(`Send attempt ${attempt} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
      
      if (!sentMessage) {
        throw new Error('Failed to send media message after multiple attempts');
      }
      
      console.log('Media message sent successfully:', sentMessage.id);
      
      // Clean up the temporary file
      try {
        fs.unlinkSync(filePath);
        console.log('Temporary file cleaned up:', filePath);
      } catch (cleanupError) {
        console.warn('Failed to clean up temporary file:', cleanupError);
      }
      
      return {
        messageId: sentMessage.id,
        timestamp: new Date().toISOString(),
        to: phoneNumber,
        message: message || '[Media]',
        fileName: fileName
      };
    } catch (error: any) {
      console.error('Failed to send media message:', error);
      
      // Clean up the temporary file even on error
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log('Temporary file cleaned up after error:', filePath);
        }
      } catch (cleanupError) {
        console.warn('Failed to clean up temporary file after error:', cleanupError);
      }
      
      throw new Error(`Failed to send media message: ${error.message || 'Unknown error'}`);
    }
  }

  async getChats() {
    try {
      if (!this.client || !this.isReady) {
        throw new Error('WhatsApp client is not ready. Please connect first.');
      }

      console.log('Fetching all chats (excluding groups)...');
      const chats = await this.client.getChats();
      
      const chatList = chats
        .filter((chat: any) => !chat.isGroup) // Exclude groups from chats
        .map((chat: any) => ({
          id: chat.id._serialized,
          name: chat.name || 'Unknown',
          isGroup: chat.isGroup,
          unreadCount: chat.unreadCount,
          lastMessage: chat.lastMessage ? {
            body: chat.lastMessage.body || '[Media]',
            timestamp: chat.lastMessage.timestamp,
            fromMe: chat.lastMessage.fromMe
          } : null,
          timestamp: chat.timestamp
        }))
        .sort((a, b) => {
          // Sort by last message timestamp or chat timestamp, newest first
          const aTime = a.lastMessage?.timestamp || a.timestamp;
          const bTime = b.lastMessage?.timestamp || b.timestamp;
          return bTime - aTime;
        });

      console.log(`Found ${chatList.length} individual chats (groups excluded)`);
      return chatList;
    } catch (error: any) {
      console.error('Failed to get chats:', error);
      throw new Error(`Failed to get chats: ${error.message || 'Unknown error'}`);
    }
  }

  // Helper method to identify AI contacts
  private isAIContact(name: string, number: string): boolean {
    const aiNames = [
      'meta ai', 'dungeon master', 'bob the robot', 'amber the detective',
      'jane austen ai', 'jade on the beat', 'left hook luiz', 'bru the sports guy',
      'chatgpt', 'claude', 'gemini', 'bard', 'copilot', 'assistant', 'ai bot',
      'virtual assistant', 'bot', 'ai helper', 'artificial intelligence',
      'whatsapp ai', 'meta assistant', 'facebook ai', 'instagram ai'
    ];
    
    const aiNumbers = [
      '13135550002', '13135550005', '13135550009', '13135550012', 
      '13135550013', '13135550014', '13135550015'
    ];
    
    const lowerName = name?.toLowerCase() || '';
    const cleanNumber = number?.replace(/[\+\-\s\(\)]/g, '') || '';
    
    // Check if name contains AI keywords
    const isAIName = aiNames.some(aiName => 
      lowerName.includes(aiName) || 
      lowerName.includes('ai') ||
      lowerName.includes('bot') ||
      lowerName.includes('assistant') ||
      lowerName.includes('chatbot')
    );
    
    // Check if number matches known AI numbers
    const isAINumber = aiNumbers.some(aiNumber => cleanNumber.includes(aiNumber));
    
    // Additional patterns for AI contacts
    const hasAIPattern = /\b(ai|bot|assistant|virtual|artificial|meta|chatgpt|claude|gemini|bard)\b/i.test(lowerName);
    
    return isAIName || isAINumber || hasAIPattern;
  }

  // Helper method to determine which contact is better when deduplicating
  private isContactBetter(candidate: any, existing: any): boolean {
    // First priority: Valid Indian phone numbers (10 digits starting with 6-9)
    const candidateClean = (candidate.number || '').replace(/\D/g, '');
    const existingClean = (existing.number || '').replace(/\D/g, '');
    
    const isValidIndianNumber = (num: string) => {
      // Remove country code if present
      const cleanNum = num.startsWith('91') ? num.slice(2) : num;
      return cleanNum.length === 10 && /^[6-9]/.test(cleanNum);
    };
    
    const candidateValidIndian = isValidIndianNumber(candidateClean);
    const existingValidIndian = isValidIndianNumber(existingClean);
    
    // Strongly prefer valid Indian numbers
    if (candidateValidIndian && !existingValidIndian) return true;
    if (!candidateValidIndian && existingValidIndian) return false;
    
    // If both or neither are valid Indian numbers, check other criteria
    
    // Prefer standard 10-digit numbers over longer ones (which might be international format errors)
    if (candidateValidIndian && existingValidIndian) {
      const candidateLen = candidateClean.startsWith('91') ? candidateClean.slice(2).length : candidateClean.length;
      const existingLen = existingClean.startsWith('91') ? existingClean.slice(2).length : existingClean.length;
      
      if (candidateLen === 10 && existingLen !== 10) return true;
      if (candidateLen !== 10 && existingLen === 10) return false;
    }
    
    // Prefer contacts with profile pictures
    if (candidate.profilePicUrl && !existing.profilePicUrl) return true;
    if (!candidate.profilePicUrl && existing.profilePicUrl) return false;
    
    // Prefer contacts that are WhatsApp contacts
    if (candidate.isWAContact && !existing.isWAContact) return true;
    if (!candidate.isWAContact && existing.isWAContact) return false;
    
    // Prefer shorter, cleaner phone numbers (less likely to be corrupted)
    if (candidateClean.length < existingClean.length && candidateClean.length >= 10) return true;
    if (existingClean.length < candidateClean.length && existingClean.length >= 10) return false;
    
    // Prefer contacts with longer, more complete names
    if (candidate.name && existing.name) {
      if (candidate.name.length > existing.name.length) return true;
      if (existing.name.length > candidate.name.length) return false;
    }
    
    // Default: keep existing
    return false;
  }

  // Store incoming messages in cache for immediate retrieval
  private async storeRealtimeMessage(message: any) {
    try {
      const chatId = message.from;
      
      // Get existing messages for this chat
      let chatMessages = this.messageCache.get(chatId) || [];
      
      // Create message object with consistent ID format
      const messageObj = {
        id: message.id?._serialized || `realtime_${Date.now()}_${Math.random()}`,
        body: message.body || '[Media]',
        timestamp: message.timestamp * 1000, // Convert to milliseconds
        fromMe: message.fromMe || false,
        author: message.author || message.from,
        type: message.type || 'chat',
        hasMedia: message.hasMedia || false,
        mediaUrl: null // Will be populated if it's a media message
      };

      // Handle media messages
      if (message.hasMedia) {
        try {
          const media = await message.downloadMedia();
          if (media) {
            messageObj.mediaUrl = `data:${media.mimetype};base64,${media.data}`;
          }
        } catch (mediaError: any) {
          console.warn('Failed to download media for message:', mediaError.message);
        }
      }
      
      // Check if this message already exists in cache to prevent duplicates
      const existingIndex = chatMessages.findIndex(existing => 
        existing.body === messageObj.body && 
        existing.fromMe === messageObj.fromMe &&
        Math.abs(existing.timestamp - messageObj.timestamp) < 2000 // Within 2 seconds
      );
      
      if (existingIndex === -1) {
        // Add to messages array only if it doesn't already exist
        chatMessages.push(messageObj);
      } else {
        console.log(`🔄 Skipped duplicate cached message: ${messageObj.body.substring(0, 50)}...`);
        return; // Don't update cache if message already exists
      }
      
      // Keep only last 100 messages per chat to avoid memory issues
      if (chatMessages.length > 100) {
        chatMessages = chatMessages.slice(-100);
      }
      
      // Sort by timestamp
      chatMessages.sort((a, b) => a.timestamp - b.timestamp);
      
      // Update cache
      this.messageCache.set(chatId, chatMessages);
      
      console.log(`💾 Cached message for chat ${chatId}: ${messageObj.body.substring(0, 50)}...`);
    } catch (error: any) {
      console.error('Error storing realtime message:', error.message);
    }
  }

  async getContacts() {
    try {
      if (!this.client || !this.isReady) {
        throw new Error('WhatsApp client is not ready. Please connect first.');
      }

      console.log('Fetching all contacts (excluding groups)...');
      const contacts = await this.client.getContacts();
      
      const filteredContacts = contacts
        .filter(contact => 
          contact.id.user && 
          !contact.id.user.includes('status') && 
          !contact.isGroup &&
          contact.isMyContact && // Only show contacts that are actually saved in the user's address book
          contact.name && 
          contact.name.trim() !== '' &&
          contact.name !== contact.id.user && // Exclude contacts where name is just the phone number
          contact.name !== 'Unknown' &&
          !contact.name.startsWith('+') && // Exclude names that are just phone numbers starting with +
          !/^\d+$/.test(contact.name) && // Exclude names that are just digits
          !this.isAIContact(contact.name, contact.number) // Exclude AI contacts
        )
        .map(contact => ({
          id: contact.id._serialized,
          name: contact.name || contact.pushname || 'Unknown',
          number: contact.number,
          isMyContact: contact.isMyContact,
          isWAContact: contact.isWAContact,
          profilePicUrl: contact.profilePicUrl || null,
          isGroup: contact.isGroup || false,
          originalContact: contact // Keep reference for deduplication logic
        }));

      // Remove duplicates by name, keeping the most valid contact
      const contactsByName = new Map();
      
      filteredContacts.forEach(contact => {
        const normalizedName = contact.name.toLowerCase().trim();
        
        if (!contactsByName.has(normalizedName)) {
          contactsByName.set(normalizedName, contact);
        } else {
          const existing = contactsByName.get(normalizedName);
          // Keep the contact with better quality indicators
          if (this.isContactBetter(contact, existing)) {
            contactsByName.set(normalizedName, contact);
          }
        }
      });

      const contactList = Array.from(contactsByName.values())
        .map(contact => ({
          id: contact.id,
          name: contact.name,
          number: contact.number,
          isMyContact: contact.isMyContact,
          isWAContact: contact.isWAContact,
          profilePicUrl: contact.profilePicUrl,
          isGroup: contact.isGroup
        }));

      console.log(`Found ${contactList.length} individual contacts (groups excluded)`);
      return contactList;
    } catch (error: any) {
      console.error('Failed to get contacts:', error);
      throw new Error(`Failed to get contacts: ${error.message || 'Unknown error'}`);
    }
  }

  // Get all groups from connected WhatsApp device
  async getGroups() {
    try {
      if (!this.client || !this.isReady) {
        throw new Error('WhatsApp client is not ready. Please connect first.');
      }

      console.log('Fetching all groups...');
      const chats = await this.client.getChats();
      
      const groupList = chats
        .filter(chat => chat.isGroup) // Only include groups
        .map(chat => ({
          id: chat.id._serialized,
          name: chat.name || 'Unknown Group',
          isGroup: chat.isGroup,
          unreadCount: chat.unreadCount,
          lastMessage: chat.lastMessage ? {
            body: chat.lastMessage.body || '[Media]',
            timestamp: chat.lastMessage.timestamp,
            fromMe: chat.lastMessage.fromMe
          } : null,
          timestamp: chat.timestamp,
          participants: chat.participants || [],
          isAdmin: chat.participants ? chat.participants.some((p: any) => p.isAdmin && p.id._serialized === this.client?.info?.wid?._serialized) : false,
          onlyAdminsCanMessage: chat.groupMetadata?.restrict || false // Check if group restricts messaging to admins only
        }))
        .sort((a, b) => {
          // Sort by last message timestamp or chat timestamp, newest first
          const aTime = a.lastMessage?.timestamp || a.timestamp;
          const bTime = b.lastMessage?.timestamp || b.timestamp;
          return bTime - aTime;
        });

      console.log(`Found ${groupList.length} groups`);
      return groupList;
    } catch (error: any) {
      console.error('Failed to get groups:', error);
      throw new Error(`Failed to get groups: ${error.message || 'Unknown error'}`);
    }
  }

  // Get chat history with a specific contact
  async getChatHistory(contactId: string) {
    try {
      if (!this.client || !this.isReady) {
        throw new Error('WhatsApp client is not ready. Please connect first.');
      }

      console.log(`Fetching chat history for contact: ${contactId}`);
      
      // Get the chat by ID
      const chat = await this.client.getChatById(contactId);
      
      if (!chat) {
        throw new Error('Chat not found');
      }

      // Fetch messages from WhatsApp (limit to last 50 for performance)
      const messages = await chat.fetchMessages({ limit: 50 });
      
      const fetchedMessages = messages.map((msg: any) => ({
        id: msg.id._serialized || msg.id.id, // Use _serialized for consistency with real-time messages
        body: msg.body || '[Media]',
        fromMe: msg.fromMe,
        timestamp: msg.timestamp * 1000, // Convert to milliseconds for consistency
        type: msg.type,
        hasMedia: msg.hasMedia,
        mediaUrl: msg.hasMedia ? msg.mediaUrl : null
      }));

      // Get cached real-time messages for this chat
      const cachedMessages = this.messageCache.get(contactId) || [];
      
      // Merge and deduplicate messages using more robust logic
      const allMessages = [...fetchedMessages, ...cachedMessages];
      const uniqueMessages = new Map();
      
      // Remove duplicates by message body, timestamp, and fromMe (more reliable than just ID)
      allMessages.forEach(msg => {
        // Create a unique key based on content and timing rather than just ID
        const timeWindow = Math.floor(msg.timestamp / 1000); // Group by second to handle slight timestamp differences
        const key = `${msg.body}_${msg.fromMe}_${timeWindow}`;
        
        // Only add if we haven't seen this exact message combination
        if (!uniqueMessages.has(key)) {
          uniqueMessages.set(key, msg);
        } else {
          // If we have a duplicate, prefer the one with a proper message ID
          const existing = uniqueMessages.get(key);
          if (msg.id && msg.id.startsWith('false_') && existing.id && !existing.id.startsWith('false_')) {
            // Keep the existing one (it has a better ID)
          } else if (existing.id && existing.id.startsWith('false_') && msg.id && !msg.id.startsWith('false_')) {
            // Replace with the new one (it has a better ID)
            uniqueMessages.set(key, msg);
          }
        }
      });
      
      // Sort by timestamp (oldest first, newest last)
      const sortedMessages = Array.from(uniqueMessages.values())
        .sort((a, b) => a.timestamp - b.timestamp);

      console.log(`Found ${sortedMessages.length} messages for chat ${contactId} (${fetchedMessages.length} fetched, ${cachedMessages.length} cached)`);
      
      return {
        contact: {
          id: chat.id._serialized,
          name: chat.name || 'Unknown',
          isGroup: chat.isGroup
        },
        messages: sortedMessages
      };
    } catch (error: any) {
      console.error('Failed to get chat history:', error);
      throw new Error(`Failed to get chat history: ${error.message || 'Unknown error'}`);
    }
  }
}

export const whatsappService = new WhatsAppService();
