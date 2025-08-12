# WhatsApp Bulk Messaging Tool - Waziper Clone

## Overview
This project is a comprehensive WhatsApp bulk messaging platform inspired by Waziper, built with React and Node.js. Its primary purpose is to enable businesses to efficiently send bulk WhatsApp messages, manage contacts, create targeted campaigns, and automate customer interactions. The platform maintains integration with WhatsApp Web, aiming to provide a robust solution for marketing and communication needs, with a vision for a SaaS model featuring tiered pricing, free trials, and scalable message-volume-based plans.

## User Preferences
- Modern TypeScript/React development stack
- Database-first approach with Drizzle ORM
- Component-based UI with shadcn/ui
- Clean, maintainable code structure
- Successfully migrated from Replit Agent to standard Replit environment (August 2025)
- Migration completed with full functionality restored: PostgreSQL database provisioned, all dependencies installed, application running on port 5000, WhatsApp client initialization fixed, logout/QR code generation functionality working properly (August 12, 2025)
- Migration completed: Database provisioned, dependencies installed, application running on port 5000, missing tsx package installed, database tables created via migration, missing POST /api/chats/:contactId/clear route added for chat clearing functionality, WebSocket broadcast issues for chat deletion and clearing resolved (August 2025)
- Enhanced scrolling functionality for chats and groups modules with sticky headers and scrollable content areas (August 2025)
- Bulk messaging module improvements completed (January 2025): Replaced "Clone & Reuse" with "Restart" functionality, fixed progress counters to use totalTargets, added scrollable interface, removed redundant bulk-messaging.tsx file, removed Refresh button and added Delete campaign functionality, removed Active Campaigns quick view component
- Advanced scheduling features implemented (August 2025): Enhanced bulk messaging with time post scheduling, random message intervals (1-3600 seconds), schedule time controls (daytime/nighttime/odd/even hours), dynamic hour management with add/remove functionality, major performance optimization by replacing heavy dropdowns with fast number inputs
- Admin-only messaging restrictions removed from bulk messaging (August 2025): Removed unnecessary restrictions from bulk messaging interface since it sends individual private messages to group participants, not group messages, so admin-only group settings don't apply
- Real-time chat management features rolled back (August 2025): Restored original chat deletion and clearing behavior due to UI stability issues, chat operations now use standard WhatsApp Web.js API methods with fallback to archiving for deletion when needed
- Media message display fixed (August 2025): Enhanced media detection logic to properly identify and display images, videos, documents, and other media content in chat interface with proper URLs for media rendering
- Contact validation and deduplication implemented (August 2025): Added comprehensive phone number validation and deduplication logic to filter out invalid numbers and remove duplicate contacts from the contacts list
- WhatsApp Web-like UI implemented (August 2025): Replaced resync button with logout button, moved QR code below account name, added WhatsApp/RCS buttons below QR, removed /account route, automated background data refresh every 60 seconds for seamless real-time experience matching official WhatsApp Web

## System Architecture
The application is built with a React frontend (TypeScript, Vite, TailwindCSS, shadcn/ui) and a Node.js backend (Express, TypeScript). Data is managed using PostgreSQL with Drizzle ORM. WhatsApp integration is handled via the `whatsapp-web.js` library, supporting QR code authentication, session persistence, and multiple WhatsApp accounts. Authentication is session-based. File storage utilizes the local file system with Multer.

**Core Features:**
- **Authentication:** User registration, login, and session management.
- **WhatsApp Integration:** QR code authentication, session persistence, multiple account support, real-time connection status.
- **Messaging:** Single and bulk message sending, media message support (images, videos, documents, audio), message scheduling, and advanced campaign management with options for target types (contact groups, local contacts, WhatsApp groups), scheduling (immediate, timed, odd/even hours), randomized delivery intervals, and real-time status monitoring.
- **Campaign Management:** Real-time progress tracking with visual progress bars using accurate totalTargets field, sent/remaining/failed message counts, campaign restart functionality for completed campaigns, auto-refresh for active campaigns, WebSocket integration for live updates, comprehensive campaign status management, and scrollable interface for better navigation.
- **Contact Management:** Contact group creation, CSV import, validation, deduplication, group member management, and bulk contact-to-group assignment. Contacts are sorted alphabetically by name.
- **Data Export/Import:** Export chats, contacts, and group participants as CSV; import contacts from CSV.
- **Dashboard & Analytics:** System status monitoring, campaign tracking, message statistics, real-time notifications.
- **UI/UX:** Component-based UI with shadcn/ui for a consistent and modern design. Illustrations are used for login/signup and landing pages, and lazy loading is implemented for images. Chat interface mirrors WhatsApp Web features.
- **Technical Implementations:** WebSocket connections for real-time updates, comprehensive logout functionality, robust media handling and display, secure session configuration, server-side sorting for consistent data display, real-time campaign progress broadcasting, and admin-only messaging restrictions with dynamic form controls and user permission validation.

**Database Schema:**
- **Users:** Authentication, profiles, email verification, WhatsApp number association.
- **WhatsApp Sessions:** Session persistence, login time tracking, session data storage.
- **WhatsApp Accounts:** Multiple account management, active status tracking, session data persistence.
- **Contact Groups:** Organized contact management, validation statistics, group-based messaging.
- **Contact Group Members:** Individual contact entries, validation, duplicate detection.
- **Bulk Message Campaigns:** Campaign creation, scheduling, delivery tracking.

## External Dependencies
- **Database:** PostgreSQL with persistent session storage
- **WhatsApp Integration:** `whatsapp-web.js` library
- **File Storage:** Multer (local file system)
- **Frontend Framework:** React
- **Backend Framework:** Node.js (Express)
- **ORM:** Drizzle ORM
- **Session Management:** connect-pg-simple for database-backed session persistence
- **UI Components:** shadcn/ui
- **Styling:** TailwindCSS
- **Module Bundler/Dev Server:** Vite