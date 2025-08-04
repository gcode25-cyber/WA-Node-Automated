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
          console.error('❌ QR generation failed:', qrError.message);
          this.qrCode = null;
        }
      });

      this.client.on('ready', async () => {
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

        // Load and broadcast initial data immediately after connection
        try {
          console.log('📊 Loading initial data for fast UI updates...');
          
          // Load all data in parallel for maximum speed
          const [chatsData, contactsData, groupsData] = await Promise.all([
            this.getChats().catch(() => []),
            this.getContacts().catch(() => []),
            this.getGroups().catch(() => [])
          ]);

          console.log(`🚀 Initial data loaded: ${chatsData.length} chats, ${contactsData.length} contacts, ${groupsData.length} groups`);
        } catch (error: any) {
          console.log('Initial data load failed (non-critical):', error.message);
        }
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

      // Listen for outgoing messages sent from phone
      this.client.on('message_create', (message: any) => {
        if (message.fromMe) {
          console.log('📱 Outgoing message from phone detected');
          this.storeRealtimeMessage(message);
        }
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
      throw error;
    }
  }

  async sendMediaMessage(phoneNumber: string, message: string, mediaPath: string, fileName: string): Promise<any> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const MessageMedia = (await import('whatsapp-web.js')).MessageMedia;
      const media = MessageMedia.fromFilePath(mediaPath);
      
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
      throw error;
    }
  }

  async getChatHistory(chatId: string, limit: number = 50): Promise<{contact: any, messages: any[]}> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      console.log(`📋 Fetching chat history for ${chatId} (limit: ${limit})`);
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
          
          // Keep real chat messages, media messages, and system messages with meaningful content
          return !isSystemMessage && !isPhoneNumberOnly && !isEmpty;
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

          return {
            id: msg.id?.id || Date.now().toString(),
            body: msg.body || (msg.hasMedia ? '[Media]' : ''),
            timestamp: msg.timestamp || Date.now(),
            fromMe: msg.fromMe || false,
            type: msg.type || 'chat',
            author: authorName,
            hasMedia: msg.hasMedia || false,
            mediaUrl: msg.hasMedia ? `/api/media/${msg.id?.id}` : undefined,
            fileName: msg.hasMedia && msg._data?.filename ? msg._data.filename : undefined
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

      console.log(`✅ Retrieved ${messageData.length} messages for chat ${chatId}`);
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
      
      console.log('✅ Real-time message stored and broadcasted');
      
    } catch (error: any) {
      console.error('Failed to store realtime message:', error.message);
    }
  }

  // Fast data loading methods for chats, groups, and contacts
  async getChats(): Promise<any[]> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      console.log('📋 Fetching all chats...');
      // Get all chats including archived ones and older conversations
      const chats = await this.client.getChats();
      
      const chatData = chats.map((chat: any) => ({
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

      // Sort chats by timestamp (most recent first for better UX)
      const sortedChats = chatData.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));

      console.log(`✅ Retrieved ${chatData.length} chats (including archived: ${chatData.filter(c => c.isArchived).length})`);
      
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

    try {
      console.log('👥 Fetching all contacts...');
      const contacts = await this.client.getContacts();
      
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
      })).filter((contact: any) => 
        contact.isWAContact && 
        contact.isMyContact && 
        contact.name && 
        contact.name !== contact.number && 
        contact.name !== contact.id
      ); // Only saved WhatsApp contacts with proper names

      console.log(`✅ Retrieved ${contactData.length} contacts`);
      
      // Broadcast to WebSocket clients for real-time updates
      this.broadcastToClients('contacts_updated', { contacts: contactData });
      
      return contactData;
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
      console.log('👥 Fetching all groups...');
      const chats = await this.client.getChats();
      const groups = chats.filter((chat: any) => chat.isGroup);
      
      const groupData = await Promise.all(
        groups.map(async (group: any) => {
          try {
            const participants = await group.participants || [];
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
              number: null // Groups don't have phone numbers
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
              number: null // Groups don't have phone numbers
            };
          }
        })
      );

      console.log(`✅ Retrieved ${groupData.length} groups`);
      
      // Broadcast to WebSocket clients for real-time updates
      this.broadcastToClients('groups_updated', { groups: groupData });
      
      return groupData;
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
      console.log(`👥 Fetching participants for group ${groupId}...`);
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
}

export const whatsappService = new WhatsAppService();