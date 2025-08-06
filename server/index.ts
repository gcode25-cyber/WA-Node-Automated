import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { WebSocketServer } from 'ws';

// Global error handlers to prevent WhatsApp ProtocolError crashes
process.on('uncaughtException', (error) => {
  if (error.message.includes('Protocol error') || 
      error.message.includes('Target closed')) {
    console.log('🔧 Handled ProtocolError (expected during WhatsApp logout):', error.message);
    // Don't exit the process for protocol errors
    return;
  }
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise) => {
  if (reason?.message?.includes('Protocol error') || 
      reason?.message?.includes('Target closed')) {
    console.log('🔧 Handled ProtocolError rejection (expected during WhatsApp logout):', reason.message);
    // Don't exit the process for protocol errors
    return;
  }
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configure PostgreSQL session store
const pgStore = connectPg(session);

// Session configuration with PostgreSQL persistence
app.use(session({
  store: new pgStore({
    conString: process.env.DATABASE_URL,
    tableName: 'sessions',
    createTableIfMissing: false, // We'll create it with Drizzle
    ttl: 30 * 24 * 60 * 60, // 30 days default TTL
  }),
  secret: process.env.SESSION_SECRET || 'fallback-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset expiration on activity
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days default
    sameSite: 'lax'
  }
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Setup WebSocket server for real-time updates
  const wss = new WebSocketServer({ server, path: '/ws' });
  
  wss.on('connection', (ws) => {
    console.log('📡 WebSocket client connected');
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('📨 Received WebSocket message:', data.type);
      } catch (e) {
        console.log('Invalid WebSocket message format');
      }
    });
    
    ws.on('close', () => {
      console.log('📡 WebSocket client disconnected');
    });
    
    ws.on('error', (error) => {
      console.error('📡 WebSocket error:', error);
    });
  });

  // Make WebSocket server available globally for WhatsApp service
  (global as any).wss = wss;

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
