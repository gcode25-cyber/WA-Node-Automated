import type { Express, Request } from "express";
import { createServer, type Server } from "http";

// Extend Express Request interface to include session
declare module "express-session" {
  interface SessionData {
    userId?: string;
    username?: string;
    userEmail?: string;
    userFullName?: string;
  }
}
import { whatsappService } from "./services/whatsapp";
import { sessionInfoSchema, qrResponseSchema, sendMessageSchema, sendMediaMessageSchema, loginSchema, signupSchema } from "@shared/schema";
import type { WhatsappAccount } from "@shared/schema";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import QRCode from "qrcode";
import qrImage from 'qr-image';

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const validatedData = loginSchema.parse(req.body);
      const user = await storage.authenticateUser(validatedData.usernameOrEmail, validatedData.password);
      
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Set up persistent session for user
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.userEmail = user.email;
      req.session.userFullName = user.fullName;
      
      // Always remember sessions for 30 days (persistent across restarts)
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      
      // Force session save to ensure persistence
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
        } else {
          console.log('✅ Session saved to database for persistent authentication');
        }
      });
      
      res.json({ 
        message: "Login successful", 
        user: { 
          id: user.id, 
          username: user.username, 
          email: user.email,
          fullName: user.fullName 
        } 
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(400).json({ error: "Invalid request data" });
    }
  });

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const validatedData = signupSchema.parse(req.body);
      
      // Check if user already exists
      const existingUserByUsername = await storage.getUserByUsername(validatedData.username);
      if (existingUserByUsername) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const existingUserByEmail = await storage.getUserByEmail(validatedData.email);
      if (existingUserByEmail) {
        return res.status(400).json({ error: "Email already exists" });
      }

      // Create user - map signup data to user insert schema
      const { confirmPassword, acceptTerms, phone, ...baseUserData } = validatedData;
      const userInsertData = {
        ...baseUserData,
        phone: phone,
        whatsappNumber: phone, // Use the phone number as WhatsApp number too
      };
      const user = await storage.createUser(userInsertData);
      
      res.status(201).json({ 
        message: "Account created successfully", 
        user: { 
          id: user.id, 
          username: user.username, 
          email: user.email,
          fullName: user.fullName 
        } 
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(400).json({ error: "Invalid request data" });
    }
  });

  // User authentication session info
  app.get("/api/auth/session", (req, res) => {
    if (req.session.userId) {
      res.json({ 
        authenticated: true, 
        user: { 
          id: req.session.userId, 
          username: req.session.username,
          email: req.session.userEmail,
          fullName: req.session.userFullName
        } 
      });
    } else {
      res.status(401).json({ error: "No active session" });
    }
  });

  // User authentication logout
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destroy error:", err);
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.clearCookie('connect.sid');
      res.json({ message: "Logged out successfully" });
    });
  });
  
  // Configure multer for file uploads
  const upload = multer({
    dest: 'uploads/',
    limits: {
      fileSize: 16 * 1024 * 1024, // 16MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/3gpp', 'video/quicktime',
        'audio/aac', 'audio/mp3', 'audio/mpeg', 'audio/amr', 'audio/ogg',
        'application/pdf', 'text/plain',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Unsupported file type'));
      }
    }
  });

  // Separate CSV upload configuration (in memory)
  const csvUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit for CSV
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'text/csv' || file.mimetype === 'application/csv' || file.originalname.endsWith('.csv')) {
        cb(null, true);
      } else {
        cb(new Error('Only CSV files are allowed'));
      }
    }
  });

  // Ensure uploads directory exists
  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
  }
  
  // Media download endpoint
  app.get('/api/media/:messageId', async (req, res) => {
    try {
      const messageId = req.params.messageId;
      
      if (!whatsappService.isClientReady()) {
        return res.status(503).json({ error: 'WhatsApp client not ready' });
      }

      // Get the message and download its media
      const mediaData = await whatsappService.downloadMessageMedia(messageId);
      
      if (!mediaData) {
        return res.status(404).json({ error: 'Media not found' });
      }

      // Set appropriate headers
      res.setHeader('Content-Type', mediaData.mimetype || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${mediaData.filename || 'media'}"`);
      
      // Send the media data
      res.send(mediaData.data);
      
    } catch (error: any) {
      console.error('Failed to download media:', error.message);
      res.status(500).json({ error: 'Failed to download media' });
    }
  });
  
  // Get QR code for WhatsApp authentication
  app.get("/api/get-qr", async (req, res) => {
    try {
      const qr = await whatsappService.getQRCode();
      if (qr) {
        // Check if QR is already a base64 data URL
        if (qr.startsWith('data:image/')) {
          console.log("✅ QR already in base64 format, returning directly");
          res.json({ qr: qr });
        } else {
          console.log("🔍 QR String length:", qr.length);
          console.log("🔍 QR String preview:", qr.substring(0, 100) + '...');
          
          try {
            // Use qr-image library directly for better large data handling
            const qrBuffer = qrImage.imageSync(qr, { 
              type: 'png', 
              size: 20, // Larger size for better scanning
              margin: 2,
              ec_level: 'L' // Low error correction for maximum data capacity
            });
            const qrBase64 = `data:image/png;base64,${qrBuffer.toString('base64')}`;
            console.log("✅ QR Code generated successfully with qr-image");
            res.json({ qr: qrBase64 });
          } catch (qrError) {
            console.error("QR generation failed:", qrError);
            // Return the raw QR string so client can handle it
            res.json({ qr: null, rawQr: qr });
          }
        }
      } else {
        res.json({ qr: null });
      }
    } catch (error) {
      console.error("QR code error:", error);
      res.status(500).json({ error: "Failed to generate QR code" });
    }
  });

  // Get current session information
  app.get("/api/session-info", async (req, res) => {
    try {
      const sessionInfo = await whatsappService.getSessionInfo();
      if (sessionInfo) {
        res.json(sessionInfo);
      } else {
        res.status(404).json({ error: "No active session" });
      }
    } catch (error) {
      console.error("Session info error:", error);
      res.status(500).json({ error: "Failed to get session info" });
    }
  });



  // Force refresh QR code
  app.post("/api/refresh-qr", async (req, res) => {
    try {
      await whatsappService.forceRefreshQR();
      res.json({ success: true, message: "QR refresh initiated" });
    } catch (error) {
      console.error("QR refresh error:", error);
      res.status(500).json({ error: "Failed to refresh QR code" });
    }
  });

  // Complete restart endpoint
  app.post("/api/restart-whatsapp", async (req, res) => {
    try {
      await whatsappService.completeRestart();
      res.json({ success: true, message: "WhatsApp service restarted completely" });
    } catch (error) {
      console.error("WhatsApp restart error:", error);
      res.status(500).json({ error: "Failed to restart WhatsApp service" });
    }
  });

  // Reconnect without clearing session files
  app.post("/api/reconnect-whatsapp", async (req, res) => {
    try {
      console.log('🔄 API: Reconnecting WhatsApp without clearing session...');
      await whatsappService.reconnectWithoutClearing();
      res.json({ success: true, message: "WhatsApp service reconnection initiated (session preserved)" });
    } catch (error) {
      console.error("WhatsApp reconnect error:", error);
      res.status(500).json({ error: "Failed to reconnect WhatsApp service" });
    }
  });

  // Force restart with session clearing
  app.post("/api/force-restart-whatsapp", async (req, res) => {
    try {
      console.log('🔄 API: Force restarting WhatsApp with session clearing...');
      await whatsappService.completeRestart();
      res.json({ success: true, message: "WhatsApp service force restarted (session cleared)" });
    } catch (error) {
      console.error("WhatsApp force restart error:", error);
      res.status(500).json({ error: "Failed to force restart WhatsApp service" });
    }
  });

  // Logout from WhatsApp
  app.post("/api/logout", async (req, res) => {
    try {
      await whatsappService.logout();
      res.json({ success: true });
    } catch (error) {
      console.error("Logout error:", error);
      // Don't return error for logout - it should still clear the session
      res.json({ success: true, warning: "Session cleared successfully" });
    }
  });

  // Get system status
  app.get("/api/system-status", async (req, res) => {
    try {
      const isReady = await whatsappService.isClientReady();
      const status = {
        client: isReady ? "Running" : "Initializing",
        puppeteer: "Stable",
        storage: "Active",
        lastCheck: new Date().toISOString(),
      };
      res.json(status);
    } catch (error) {
      console.error("System status error:", error);
      res.status(500).json({ error: "Failed to get system status" });
    }
  });

  // Trigger data synchronization
  app.post("/api/sync-data", async (req, res) => {
    try {
      const isReady = await whatsappService.isClientReady();
      if (!isReady) {
        return res.status(400).json({ 
          success: false, 
          error: "WhatsApp client not connected. Please scan QR code first to authenticate." 
        });
      }
      
      const sessionInfo = await whatsappService.getSessionInfo();
      if (!sessionInfo) {
        return res.status(503).json({ 
          success: false, 
          error: "WhatsApp session not available. Please reconnect by scanning QR code." 
        });
      }

      await whatsappService.triggerDataSync();
      res.json({ success: true, message: "Data synchronization completed successfully" });
    } catch (error: any) {
      console.error("Data sync error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to sync data" 
      });
    }
  });

  // Get chat history for a specific chat
  app.get("/api/chats/:chatId/history", async (req, res) => {
    try {
      const { chatId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const chatHistory = await whatsappService.getChatHistory(chatId, limit);
      res.json(chatHistory);
    } catch (error: any) {
      console.error("Get chat history error:", error);
      res.status(500).json({ error: error.message || "Failed to get chat history" });
    }
  });



  // Send message
  app.post("/api/send-message", async (req, res) => {
    try {
      const parsed = sendMessageSchema.parse(req.body);
      const result = await whatsappService.sendMessage(
        parsed.phoneNumber,
        parsed.message
      );
      res.json({ success: true, messageId: result.messageId });
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to send message" 
      });
    }
  });

  // Send media message
  app.post("/api/send-media-message", upload.single('media'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No media file provided" });
      }

      const parsed = sendMediaMessageSchema.parse({
        phoneNumber: req.body.phoneNumber,
        message: req.body.message,
      });

      const result = await whatsappService.sendMediaMessage(
        parsed.phoneNumber,
        parsed.message || '',
        req.file.path,
        req.file.originalname || 'media'
      );
      
      res.json({ success: true, messageId: result.messageId, fileName: result.fileName });
    } catch (error) {
      console.error("Send media message error:", error);
      
      // Clean up uploaded file on error
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.warn("Failed to clean up uploaded file:", cleanupError);
        }
      }
      
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to send media message" 
      });
    }
  });

  // Get all chats from connected WhatsApp device (sorted oldest to newest as requested)
  app.get("/api/chats", async (req, res) => {
    try {
      // Check if WhatsApp service is ready first
      const sessionInfo = await whatsappService.getSessionInfo();
      if (!sessionInfo) {
        return res.status(503).json({ error: "WhatsApp not connected" });
      }

      const chats = await whatsappService.getChats();
      // Sort chats oldest to newest (ascending timestamp)
      const sortedChats = chats.sort((a: any, b: any) => a.timestamp - b.timestamp);
      res.json(sortedChats);
    } catch (error: any) {
      console.error("Get chats error:", error);
      res.status(500).json({ error: error.message || "Failed to get chats" });
    }
  });

  // Get all contacts from connected WhatsApp device
  app.get("/api/contacts", async (req, res) => {
    try {
      // Check if WhatsApp service is ready first
      const sessionInfo = await whatsappService.getSessionInfo();
      if (!sessionInfo) {
        return res.status(503).json({ error: "WhatsApp not connected" });
      }

      const contacts = await whatsappService.getContacts();
      res.json(contacts);
    } catch (error: any) {
      console.error("Get contacts error:", error);
      res.status(500).json({ error: error.message || "Failed to get contacts" });
    }
  });

  // Get all groups from connected WhatsApp device
  app.get("/api/groups", async (req, res) => {
    try {
      // Check if WhatsApp service is ready first
      const sessionInfo = await whatsappService.getSessionInfo();
      if (!sessionInfo) {
        return res.status(503).json({ error: "WhatsApp not connected" });
      }

      const groups = await whatsappService.getGroups();
      res.json(groups);
    } catch (error: any) {
      console.error("Get groups error:", error);
      res.status(500).json({ error: error.message || "Failed to get groups" });
    }
  });

  // Download chats as CSV
  app.get("/api/chats/download", async (req, res) => {
    try {
      const chats = await whatsappService.getChats();
      
      // Convert to CSV format
      const csvHeader = 'Name,Phone Number,Is Group,Unread Count,Last Message,Last Message Time,From Me\n';
      const csvRows = chats.map((chat: any) => {
        const lastMsg = chat.lastMessage ? chat.lastMessage.body.replace(/"/g, '""') : '';
        const lastMsgTime = chat.lastMessage ? new Date(chat.lastMessage.timestamp * 1000).toISOString() : '';
        const fromMe = chat.lastMessage ? chat.lastMessage.fromMe : '';
        
        return `"${chat.name}","${chat.id}","${chat.isGroup}","${chat.unreadCount}","${lastMsg}","${lastMsgTime}","${fromMe}"`;
      }).join('\n');
      
      const csvContent = '\uFEFF' + csvHeader + csvRows;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="whatsapp_chats.csv"');
      res.send(csvContent);
    } catch (error: any) {
      console.error("Download chats error:", error);
      res.status(500).json({ error: error.message || "Failed to download chats" });
    }
  });

  // Download contacts as CSV
  app.get("/api/contacts/download", async (req, res) => {
    try {
      const contacts = await whatsappService.getContacts();
      
      // Convert to CSV format
      const csvHeader = 'Name,Phone Number,Is My Contact,Is WhatsApp Contact,Is Group\n';
      const csvRows = contacts.map((contact: any) => {
        return `"${contact.name}","${contact.number || contact.id}","${contact.isMyContact}","${contact.isWAContact}","${contact.isGroup}"`;
      }).join('\n');
      
      const csvContent = '\uFEFF' + csvHeader + csvRows;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="whatsapp_contacts.csv"');
      res.send(csvContent);
    } catch (error: any) {
      console.error("Download contacts error:", error);
      res.status(500).json({ error: error.message || "Failed to download contacts" });
    }
  });

  // Download groups as CSV with participant phone numbers
  app.get("/api/groups/download", async (req, res) => {
    try {
      const groups = await whatsappService.getGroups();
      
      // Convert to CSV format with ID and Numbers columns
      const csvHeader = 'ID,Numbers\n';
      let rowIndex = 1;
      const csvRows: string[] = [];
      
      groups.forEach((group: any) => {
        if (group.participants) {
          const participantNumbers = group.participants
            .map((p: any) => p.id._serialized || p.id)
            .filter((id: string) => id.includes('@c.us'))
            .map((id: string) => id.split('@')[0]);
          
          participantNumbers.forEach((number: string) => {
            csvRows.push(`${rowIndex},${number}`);
            rowIndex++;
          });
        }
      });
      
      const csvContent = '\uFEFF' + csvHeader + csvRows.join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="whatsapp_groups.csv"');
      res.send(csvContent);
    } catch (error: any) {
      console.error("Download groups error:", error);
      res.status(500).json({ error: error.message || "Failed to download groups" });
    }
  });

  // Export individual group as CSV 
  app.get("/api/groups/:groupId/export", async (req, res) => {
    try {
      const { groupId } = req.params;
      
      if (!groupId) {
        return res.status(400).json({ error: "Group ID is required" });
      }
      
      const groups = await whatsappService.getGroups();
      const group = groups.find((g: any) => g.id === groupId);
      
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      
      // Convert to CSV format with ID and Numbers columns
      const csvHeader = 'ID,Numbers\n';
      const participantNumbers = group.participants 
        ? group.participants
            .map((p: any) => p.id._serialized || p.id)
            .filter((id: string) => id.includes('@c.us'))
            .map((id: string) => id.split('@')[0])
        : [];
      
      const csvRows = participantNumbers.map((number: string, index: number) => `${index + 1},${number}`).join('\n');
      const csvContent = '\uFEFF' + csvHeader + csvRows;
      
      // Create safe filename from group name
      const safeGroupName = group.name.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${safeGroupName}_participants.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);
    } catch (error: any) {
      console.error("Export group error:", error);
      res.status(500).json({ error: error.message || "Failed to export group" });
    }
  });

  // Download single group as CSV with participant phone numbers (deprecated)
  app.get("/api/groups/download-single", async (req, res) => {
    try {
      const { groupId } = req.query;
      
      if (!groupId || typeof groupId !== 'string') {
        return res.status(400).json({ error: "Group ID is required" });
      }
      
      const groups = await whatsappService.getGroups();
      const group = groups.find((g: any) => g.id === groupId);
      
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      
      // Convert to CSV format with ID and Numbers columns
      const csvHeader = 'ID,Numbers\n';
      const participantNumbers = group.participants 
        ? group.participants
            .map((p: any) => p.id._serialized || p.id)
            .filter((id: string) => id.includes('@c.us'))
            .map((id: string) => id.split('@')[0])
        : [];
      
      const csvRows = participantNumbers.map((number: string, index: number) => `${index + 1},${number}`).join('\n');
      const csvContent = '\uFEFF' + csvHeader + csvRows;
      
      // Create safe filename from group name
      const safeGroupName = group.name.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${safeGroupName}_participants.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);
    } catch (error: any) {
      console.error("Download single group error:", error);
      res.status(500).json({ error: error.message || "Failed to download group" });
    }
  });

  // Get chat history with a specific contact
  app.get("/api/chat-history/:contactId", async (req, res) => {
    try {
      const { contactId } = req.params;
      const chatHistory = await whatsappService.getChatHistory(contactId);
      res.json(chatHistory);
    } catch (error: any) {
      console.error("Get chat history error:", error);
      res.status(500).json({ error: error.message || "Failed to get chat history" });
    }
  });

  // Contact Groups API
  app.get("/api/contact-groups", async (req, res) => {
    try {
      const groups = await storage.getContactGroups();
      res.json(groups);
    } catch (error: any) {
      console.error("Get contact groups error:", error);
      res.status(500).json({ error: error.message || "Failed to get contact groups" });
    }
  });

  app.post("/api/contact-groups", async (req, res) => {
    try {
      const { name, description } = req.body;
      
      if (!name || name.trim() === '') {
        return res.status(400).json({ error: "Group name is required" });
      }

      const group = await storage.createContactGroup({
        name: name.trim(),
        description: description?.trim() || null
      });

      res.json(group);
    } catch (error: any) {
      console.error("Create contact group error:", error);
      res.status(500).json({ error: error.message || "Failed to create contact group" });
    }
  });

  app.post("/api/contact-groups/:groupId/import-csv", csvUpload.single('csv'), async (req, res) => {
    try {
      const { groupId } = req.params;
      
      if (!req.file) {
        return res.status(400).json({ error: "CSV file is required" });
      }

      const group = await storage.getContactGroup(groupId);
      if (!group) {
        return res.status(404).json({ error: "Contact group not found" });
      }

      // Parse CSV file from memory buffer
      const csvContent = req.file.buffer.toString('utf8');
      const lines = csvContent.split(/\r?\n/).filter(line => line.trim());

      // Clear existing members
      await storage.deleteContactGroupMembers(groupId);

      let totalContacts = 0;
      let validContacts = 0;
      let invalidContacts = 0;
      let duplicateContacts = 0;
      const processedNumbers = new Set();
      const membersToInsert: { groupId: string; phoneNumber: string; name: null; status: 'valid' | 'invalid' }[] = [];

      for (const line of lines) {
        if (!line.trim()) continue;

        const tokens = line.split(/[;,\t]+|\s+/).map(t => t.trim()).filter(Boolean);
        if (tokens.length === 0) continue;

        const firstLower = tokens[0].toLowerCase();
        if (firstLower === 'id' || firstLower.includes('phone') || firstLower.includes('number')) {
          continue;
        }

        totalContacts++;
        let phoneNumber = tokens.length > 1 ? tokens[tokens.length - 1] : tokens[0];
        phoneNumber = phoneNumber.replace(/[^0-9+]/g, '');

        if (phoneNumber && !phoneNumber.startsWith('+') && phoneNumber.length === 10) {
          phoneNumber = '+91' + phoneNumber;
        }

        if (!phoneNumber || phoneNumber.length < 10) {
          invalidContacts++;
          continue;
        }

        if (processedNumbers.has(phoneNumber)) {
          duplicateContacts++;
          continue;
        }

        processedNumbers.add(phoneNumber);
        validContacts++;

        membersToInsert.push({
          groupId,
          phoneNumber,
          name: null, // No name in the CSV format
          status: "valid"
        });
      }

      // Bulk insert all valid members at once
      if (membersToInsert.length > 0) {
        await storage.createContactGroupMembersBulk(membersToInsert);
      }

      // Update group statistics
      await storage.updateContactGroup(groupId, {
        totalContacts,
        validContacts,
        invalidContacts,
        duplicateContacts
      });

      res.json({
        success: true,
        totalContacts,
        validContacts,
        invalidContacts,
        duplicateContacts
      });

    } catch (error: any) {
      console.error("Import CSV error:", error);
      res.status(500).json({ error: error.message || "Failed to import CSV" });
    }
  });

  app.delete("/api/contact-groups/:groupId", async (req, res) => {
    try {
      const { groupId } = req.params;
      await storage.deleteContactGroup(groupId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete contact group error:", error);
      res.status(500).json({ error: error.message || "Failed to delete contact group" });
    }
  });

  app.get("/api/contact-groups/:groupId/export", async (req, res) => {
    try {
      const { groupId } = req.params;
      const group = await storage.getContactGroup(groupId);
      const members = await storage.getContactGroupMembers(groupId);
      
      if (!group) {
        return res.status(404).json({ error: "Contact group not found" });
      }

      const csvHeader = 'id,phone_number\n';
      const csvRows = members.map((member, index) => 
        `${index + 1},${member.phoneNumber.replace('+91', '')}`
      ).join('\n');
      
      const csvContent = csvHeader + csvRows;
      const safeGroupName = group.name.replace(/[^a-zA-Z0-9]/g, '_');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${safeGroupName}_contacts.csv"`);
      res.send(csvContent);
    } catch (error: any) {
      console.error("Export contact group error:", error);
      res.status(500).json({ error: error.message || "Failed to export contact group" });
    }
  });

  // Get contact group details
  app.get("/api/contact-groups/:groupId", async (req, res) => {
    try {
      const { groupId } = req.params;
      const group = await storage.getContactGroup(groupId);
      
      if (!group) {
        return res.status(404).json({ error: "Contact group not found" });
      }

      res.json(group);
    } catch (error: any) {
      console.error("Get contact group error:", error);
      res.status(500).json({ error: error.message || "Failed to get contact group" });
    }
  });

  // Get contact group members
  app.get("/api/contact-groups/:groupId/members", async (req, res) => {
    try {
      const { groupId } = req.params;
      const members = await storage.getContactGroupMembers(groupId);
      res.json(members);
    } catch (error: any) {
      console.error("Get contact group members error:", error);
      res.status(500).json({ error: error.message || "Failed to get contact group members" });
    }
  });

  // Import contacts to group 
  app.post("/api/contact-groups/:groupId/import", csvUpload.single('file'), async (req, res) => {
    try {
      const { groupId } = req.params;
      
      if (!req.file) {
        return res.status(400).json({ error: "CSV file is required" });
      }

      const group = await storage.getContactGroup(groupId);
      if (!group) {
        return res.status(404).json({ error: "Contact group not found" });
      }

      // Parse CSV file from memory buffer
      const csvContent = req.file.buffer.toString('utf8');
      const lines = csvContent.split(/\r?\n/).filter(line => line.trim());

      let totalContacts = 0;
      let validContacts = 0;
      let invalidContacts = 0;
      let duplicateContacts = 0;
      const existingMembers = await storage.getContactGroupMembers(groupId);
      const existingNumbers = new Set(existingMembers.map(m => m.phoneNumber));

      for (const line of lines) {
        if (!line.trim()) continue;

        const tokens = line.split(/[;,\t]+|\s+/).map(t => t.trim()).filter(Boolean);
        if (tokens.length === 0) continue;

        const firstLower = tokens[0].toLowerCase();
        if (firstLower === 'id' || firstLower.includes('phone') || firstLower.includes('number')) {
          continue;
        }

        totalContacts++;
        let phoneNumber = tokens.length > 1 ? tokens[tokens.length - 1] : tokens[0];
        phoneNumber = phoneNumber.replace(/[^0-9+]/g, '');

        if (phoneNumber && !phoneNumber.startsWith('+') && phoneNumber.length === 10) {
          phoneNumber = '+91' + phoneNumber;
        }

        if (!phoneNumber || phoneNumber.length < 10) {
          invalidContacts++;
          continue;
        }

        if (existingNumbers.has(phoneNumber)) {
          duplicateContacts++;
          continue;
        }

        existingNumbers.add(phoneNumber);
        validContacts++;

        await storage.createContactGroupMember({
          groupId,
          phoneNumber,
          name: null,
          status: "valid"
        });
      }

      // Update group statistics
      const updatedGroup = await storage.updateContactGroup(groupId, {
        totalContacts: group.totalContacts + validContacts,
        validContacts: group.validContacts + validContacts,
        invalidContacts: group.invalidContacts + invalidContacts,
        duplicateContacts: group.duplicateContacts + duplicateContacts
      });

      res.json({
        success: true,
        imported: validContacts,
        duplicates: duplicateContacts,
        invalid: invalidContacts,
        total: totalContacts
      });

    } catch (error: any) {
      console.error("Import contacts error:", error);
      res.status(500).json({ error: error.message || "Failed to import contacts" });
    }
  });

  // Add single contact to group
  app.post("/api/contact-groups/:groupId/members", async (req, res) => {
    try {
      const { groupId } = req.params;
      const { name, phoneNumber } = req.body;

      if (!name || !phoneNumber) {
        return res.status(400).json({ error: "Name and phone number are required" });
      }

      const group = await storage.getContactGroup(groupId);
      if (!group) {
        return res.status(404).json({ error: "Contact group not found" });
      }

      // Check if phone number already exists in the group
      const existingMembers = await storage.getContactGroupMembers(groupId);
      const existingNumbers = new Set(existingMembers.map(m => m.phoneNumber));
      
      if (existingNumbers.has(phoneNumber)) {
        return res.status(400).json({ error: "Phone number already exists in this group" });
      }

      // Add the contact
      const newMember = await storage.createContactGroupMember({
        groupId,
        phoneNumber,
        name,
        status: "valid"
      });

      // Update group statistics
      await storage.updateContactGroup(groupId, {
        totalContacts: group.totalContacts + 1,
        validContacts: group.validContacts + 1
      });

      res.json({ success: true, member: newMember });

    } catch (error: any) {
      console.error("Add contact error:", error);
      res.status(500).json({ error: error.message || "Failed to add contact" });
    }
  });

  // Batch delete contact group members
  app.delete("/api/contact-groups/:groupId/members/batch-delete", async (req, res) => {
    try {
      const { groupId } = req.params;
      const { memberIds } = req.body;

      if (!memberIds || !Array.isArray(memberIds)) {
        return res.status(400).json({ error: "Member IDs array is required" });
      }

      const group = await storage.getContactGroup(groupId);
      if (!group) {
        return res.status(404).json({ error: "Contact group not found" });
      }

      // Bulk delete all selected members at once
      await storage.deleteContactGroupMembersBulk(memberIds);

      // Update group member counts
      const remainingMembers = await storage.getContactGroupMembers(groupId);
      const validCount = remainingMembers.filter(m => m.status === 'valid').length;
      const invalidCount = remainingMembers.filter(m => m.status === 'invalid').length;
      const duplicateCount = remainingMembers.filter(m => m.status === 'duplicate').length;

      await storage.updateContactGroup(groupId, {
        totalContacts: remainingMembers.length,
        validContacts: validCount,
        invalidContacts: invalidCount,
        duplicateContacts: duplicateCount
      });

      res.json({ success: true, deletedCount: memberIds.length });
    } catch (error: any) {
      console.error("Batch delete members error:", error);
      res.status(500).json({ error: error.message || "Failed to delete members" });
    }
  });

  app.post("/api/contact-groups/:groupId/send", async (req, res) => {
    try {
      const { groupId } = req.params;
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const group = await storage.getContactGroup(groupId);
      if (!group) {
        return res.status(404).json({ error: "Contact group not found" });
      }

      const members = await storage.getContactGroupMembers(groupId);
      let sentCount = 0;
      let failedCount = 0;

      for (const member of members) {
        if (member.status !== "valid") continue;

        try {
          await whatsappService.sendMessage(member.phoneNumber, message);
          sentCount++;
          await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));
        } catch (error) {
          console.error(`Failed to send message to ${member.phoneNumber}:`, error);
          failedCount++;
        }
      }

      res.json({
        success: true,
        sentCount,
        failedCount,
        totalMembers: members.filter((m) => m.status === "valid").length,
      });
    } catch (error: any) {
      console.error("Send contact group messages error:", error);
      res.status(500).json({ error: error.message || "Failed to send messages" });
    }
  });

  // Export all groups as separate CSV files (returns JSON with file data)
  app.get("/api/groups/export-all-csv", async (req, res) => {
    try {
      if (!(whatsappService as any).isReady) {
        return res.status(400).json({ error: "WhatsApp not connected" });
      }

      const groups = await whatsappService.getGroups();
      
      if (groups.length === 0) {
        return res.status(404).json({ error: "No groups found" });
      }

      // Create a map to store CSV files
      const csvFiles: { [filename: string]: string } = {};
      
      for (const group of groups) {
        const participants = group.participants || [];
        const numbers: string[] = [];
        
        for (const participant of participants) {
          if (participant.id && participant.id._serialized) {
            // Extract phone number from WhatsApp ID format
            let phoneNumber = participant.id._serialized.replace('@c.us', '').replace('@g.us', '');
            
            // Clean and format phone number
            phoneNumber = phoneNumber.replace(/[^0-9+]/g, '');
            
            // Add +91 prefix if not present and it's a 10-digit number
            if (!phoneNumber.startsWith('+') && phoneNumber.length === 10) {
              phoneNumber = '+91' + phoneNumber;
            }
            
            // Remove +91 prefix for CSV as requested
            if (phoneNumber.startsWith('+91')) {
              phoneNumber = phoneNumber.substring(3);
            }
            
            if (phoneNumber.length >= 10) {
              numbers.push(phoneNumber);
            }
          }
        }
        
        // Create CSV content for this group with one number per row
        const csvContent = '\uFEFF' + numbers.join('\n');
        
        // Create safe filename from group name
        const safeGroupName = (group.name || `Group_${group.id}`)
          .replace(/[^a-zA-Z0-9\s]/g, '_')
          .replace(/\s+/g, '_')
          .substring(0, 50); // Limit filename length
        
        csvFiles[`${safeGroupName}.csv`] = csvContent;
      }

      // Return JSON with all CSV files
      res.json({
        success: true,
        files: csvFiles,
        totalGroups: groups.length
      });
    } catch (error: any) {
      console.error("Export all groups error:", error);
      res.status(500).json({ error: error.message || "Failed to export CSV files" });
    }
  });

  // Bulk Message Campaigns API
  app.post("/api/bulk-campaigns", async (req, res) => {
    try {
      const { campaignName, contactGroupId, message, scheduledAt } = req.body;
      
      if (!campaignName || !contactGroupId || !message) {
        return res.status(400).json({ error: "Campaign name, contact group, and message are required" });
      }

      // Verify contact group exists
      const group = await storage.getContactGroup(contactGroupId);
      if (!group) {
        return res.status(404).json({ error: "Contact group not found" });
      }

      const campaign = await storage.createBulkMessageCampaign({
        name: campaignName,
        contactGroupId,
        message,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: "draft",
        mediaUrl: null
      });

      res.json(campaign);
    } catch (error: any) {
      console.error("Create bulk campaign error:", error);
      res.status(500).json({ error: error.message || "Failed to create bulk campaign" });
    }
  });

  app.post("/api/bulk-campaigns/:campaignId/send", async (req, res) => {
    try {
      const { campaignId } = req.params;
      
      const campaign = await storage.updateBulkMessageCampaign(campaignId, {
        status: "running"
      });

      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      // Get contact group members
      const members = await storage.getContactGroupMembers(campaign.contactGroupId);
      let sentCount = 0;
      let failedCount = 0;

      // Send messages to all valid members
      for (const member of members) {
        if (member.status !== "valid") continue;
        
        try {
          await whatsappService.sendMessage(member.phoneNumber, campaign.message);
          sentCount++;
          
          // Add delay between messages (1-3 seconds)
          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        } catch (error) {
          console.error(`Failed to send message to ${member.phoneNumber}:`, error);
          failedCount++;
        }
      }

      // Update campaign status
      await storage.updateBulkMessageCampaign(campaignId, {
        status: "completed",
        sentCount,
        failedCount
      });

      res.json({
        success: true,
        sentCount,
        failedCount,
        totalMembers: members.filter(m => m.status === "valid").length
      });

    } catch (error: any) {
      console.error("Send bulk campaign error:", error);
      
      // Update campaign status to failed (if campaignId is available)
      try {
        const { campaignId } = req.params;
        await storage.updateBulkMessageCampaign(campaignId, {
          status: "failed"
        });
      } catch (updateError) {
        console.error("Failed to update campaign status:", updateError);
      }
      
      res.status(500).json({ error: error.message || "Failed to send bulk campaign" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
