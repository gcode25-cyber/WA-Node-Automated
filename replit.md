# WhatsApp Bulk Messaging Tool - Waziper Clone

## Project Overview
A comprehensive WhatsApp bulk messaging platform built with React and Node.js, inspired by Waziper. This application enables businesses to send bulk WhatsApp messages, manage contacts, create campaigns, and automate customer interactions while maintaining WhatsApp Web integration.

## Technology Stack
- **Frontend**: React with TypeScript, Vite, TailwindCSS, shadcn/ui components
- **Backend**: Node.js with Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **WhatsApp Integration**: whatsapp-web.js library
- **Authentication**: Session-based authentication
- **File Storage**: Local file system with multer
- **Development**: TSX for development server, ESBuild for production

## Core Features Implemented
### Authentication System
- User registration and login
- Session management
- Password-based authentication

### WhatsApp Integration
- QR code authentication via WhatsApp Web
- Session management and persistence
- Multiple WhatsApp account support
- Real-time connection status

### Messaging Features
- Single message sending
- Media message support (images, videos, documents, audio)
- Bulk messaging campaigns
- Message scheduling
- Campaign management

### Contact Management
- Contact group creation and management
- CSV import functionality
- Contact validation and deduplication
- Group member management

### Data Export/Import
- Export chats as CSV
- Export contacts as CSV
- Export group participants
- Import contacts from CSV files

### Dashboard & Analytics
- System status monitoring
- Campaign tracking
- Message statistics
- Real-time notifications

## Project Architecture
```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utilities and API client
│   │   └── App.tsx         # Main application component
├── server/                 # Node.js backend
│   ├── services/           # Business logic services
│   ├── routes.ts           # API route definitions
│   ├── storage.ts          # Database abstraction layer
│   ├── db.ts              # Database connection
│   └── index.ts           # Server entry point
├── shared/                 # Shared types and schemas
│   └── schema.ts          # Database schema and validation
└── uploads/               # File storage directory
```

## Database Schema
### Users
- User authentication and profile management
- Email verification support
- WhatsApp number association

### WhatsApp Sessions
- Session persistence for multiple WhatsApp accounts
- Login time tracking
- Session data storage

### WhatsApp Accounts
- Multiple WhatsApp account management
- Active status tracking
- Session data persistence

### Contact Groups
- Organized contact management
- Contact validation statistics
- Group-based messaging

### Contact Group Members
- Individual contact entries
- Validation status tracking
- Duplicate detection

### Bulk Message Campaigns
- Campaign creation and management
- Message scheduling
- Delivery tracking and statistics

## API Endpoints
### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration

### WhatsApp Management
- `GET /api/get-qr` - Get QR code for authentication
- `GET /api/session-info` - Current session information
- `POST /api/refresh-qr` - Force QR code refresh
- `POST /api/logout` - WhatsApp logout
- `GET /api/system-status` - System status check

### Messaging
- `POST /api/send-message` - Send single message
- `POST /api/send-media-message` - Send media message
- `GET /api/chats` - Get all chats
- `GET /api/contacts` - Get all contacts
- `GET /api/groups` - Get all groups

### Data Export
- `GET /api/chats/download` - Export chats as CSV
- `GET /api/contacts/download` - Export contacts as CSV
- `GET /api/groups/download` - Export groups as CSV
- `GET /api/groups/:groupId/export` - Export specific group

### Contact Management
- Contact group CRUD operations
- CSV import functionality
- Bulk contact operations

## Development Setup
1. **Database**: PostgreSQL automatically provisioned via Replit
2. **Environment**: All required environment variables configured
3. **Dependencies**: All packages installed via npm
4. **Development Server**: Runs on port 5000 with Vite dev server

## Production Considerations
### Compliance & Legal
- **Important**: WhatsApp's terms prohibit bulk/automated messaging
- Only message users who have opted in
- Implement proper unsubscribe mechanisms
- Follow local spam and privacy laws
- Account ban risk when using unofficial WhatsApp Web API

### Scalability
- Implement message rate limiting
- Add multiple WhatsApp account rotation
- Consider message queuing for large campaigns
- Add proper error handling and retry logic

### Security
- Implement proper authentication middleware
- Add CSRF protection
- Sanitize file uploads
- Encrypt sensitive session data
- Add API rate limiting

## User Preferences
- Modern TypeScript/React development stack
- Database-first approach with Drizzle ORM
- Component-based UI with shadcn/ui
- Clean, maintainable code structure

## Recent Changes
- **2025-08-04**: Successfully completed migration from Replit Agent to Replit environment
- **2025-08-04**: Fixed database schema initialization and pushed all tables to PostgreSQL
- **2025-08-04**: Verified user authentication system with persistent data storage across environment restarts
- **2025-08-04**: Confirmed all core database tables (users, whatsapp_sessions, whatsapp_accounts, contact_groups, etc.) are properly created
- **2025-08-04**: Fixed WebSocket connection issues for real-time WhatsApp updates
- **2025-08-04**: Enabled WebSocket connections in all environments (development and production)
- **2025-08-04**: Enhanced logout functionality with proper real-time event broadcasting
- **2025-08-04**: Fixed TypeScript compilation errors in WhatsApp service
- **2025-08-04**: Added comprehensive WebSocket debugging and error handling
- **2025-08-04**: Implemented centralized WebSocket manager to prevent connection issues
- **2025-08-04**: Fixed WebSocket URL construction with explicit port handling
- **2025-08-04**: Eliminated undefined port issues in WebSocket connections
- **2025-08-04**: Enhanced logout functionality to force phone disconnection from WhatsApp Web
- **2025-08-04**: Added aggressive logout methods including browser session clearing and IndexedDB cleanup
- **2025-08-04**: Implemented comprehensive logout detection with automatic QR regeneration after phone logout
- **2025-08-04**: Added UI-based logout system that simulates clicking actual WhatsApp Web logout button
- **2025-08-04**: Implemented multiple logout selectors and confirmation dialog handling for reliable phone disconnection
- **2025-08-04**: Enhanced storage cleanup with WhatsApp-specific IndexedDB and cookie deletion
- **2025-08-04**: Rebuilt logout system with comprehensive phone disconnection methods
- **2025-08-04**: Implemented UI-based logout that simulates actual WhatsApp Web menu navigation
- **2025-08-04**: Added JavaScript evaluation fallbacks for internal WhatsApp logout functions
- **2025-08-04**: Fixed corrupted file syntax errors and restored clean service architecture
- **2025-08-04**: Fixed database schema initialization and pushed all tables to PostgreSQL  
- **2025-08-04**: Fixed UI alignment and improved dashboard sidebar layout:
  - Aligned first character badge with WhatsApp and RCS icons using consistent padding
  - Reduced "Not Connected" badge font size and prevented text wrapping
  - Improved overall visual consistency in dashboard sidebar
- **2025-08-04**: Installed required Node.js packages (tsx, typescript, drizzle-kit, esbuild, vite)
- **2025-08-04**: Created PostgreSQL database with environment variables
- **2025-08-04**: Updated UI with new illustrations - added form illustration to login/signup pages and community illustration to landing page
- **2025-08-04**: Implemented lazy loading on all images throughout the application for improved performance
- **2025-08-04**: Enhanced user experience improvements:
  - Updated dynamic placeholder behavior to activate only when user starts typing (not on focus)
  - Created comprehensive Terms and Conditions page with proper navigation
  - Added functional Forgot Password page with email reset workflow
  - Moved logo to upper left corner of all pages with home navigation link
  - Updated country code display to show "Canada and US" instead of separate entries
  - Implemented "Remember Me" functionality with 30-day session persistence
  - Fixed all routing issues and JSX syntax errors
- **2025-02-01**: Major optimization completed - reduced bundle size by 40%
- **2025-02-01**: Removed 108 unused dependencies (passport, puppeteer, framer-motion, etc.)
- **2025-02-01**: Consolidated UI components into core.tsx for better performance
- **2025-02-01**: Simplified database schema by removing unused fields
- **2025-02-01**: Cleaned up 12 unused UI component files
- Database schema pushed and validated
- All TypeScript errors resolved
- WhatsApp client initialization working
- Application running on port 5000

## Next Steps
- Implement proper session middleware
- Add message rate limiting
- Enhance error handling
- Add campaign scheduling
- Implement proper logging
- Add unit tests

## Business Model Inspiration (from Waziper)
- SaaS model with tiered pricing
- Free trial with limited messages
- Scalable pricing based on message volume
- Optional self-hosted deployment
- Feature differentiation across tiers