# WhatsApp Bulk Messaging Tool - Waziper Clone

## Overview
This project is a comprehensive WhatsApp bulk messaging platform inspired by Waziper, built with React and Node.js. Its primary purpose is to enable businesses to efficiently send bulk WhatsApp messages, manage contacts, create targeted campaigns, and automate customer interactions. The platform maintains integration with WhatsApp Web, aiming to provide a robust solution for marketing and communication needs, with a vision for a SaaS model featuring tiered pricing, free trials, and scalable message-volume-based plans.

## User Preferences
- Modern TypeScript/React development stack
- Database-first approach with Drizzle ORM
- Component-based UI with shadcn/ui
- Clean, maintainable code structure

## System Architecture
The application is built with a React frontend (TypeScript, Vite, TailwindCSS, shadcn/ui) and a Node.js backend (Express, TypeScript). Data is managed using PostgreSQL with Drizzle ORM. WhatsApp integration is handled via the `whatsapp-web.js` library, supporting QR code authentication, session persistence, and multiple WhatsApp accounts. Authentication is session-based. File storage utilizes the local file system with Multer.

**Core Features:**
- **Authentication:** User registration, login, and session management.
- **WhatsApp Integration:** QR code authentication, session persistence, multiple account support, real-time connection status.
- **Messaging:** Single and bulk message sending, media message support (images, videos, documents, audio), message scheduling, campaign management.
- **Contact Management:** Contact group creation, CSV import, validation, deduplication, and group member management.
- **Data Export/Import:** Export chats, contacts, and group participants as CSV; import contacts from CSV.
- **Dashboard & Analytics:** System status monitoring, campaign tracking, message statistics, real-time notifications.
- **UI/UX:** Component-based UI with shadcn/ui for a consistent and modern design. Illustrations are used for login/signup and landing pages, and lazy loading is implemented for images.
- **Technical Implementations:** WebSocket connections for real-time updates, comprehensive logout functionality including IndexedDB and cookie cleanup, robust media handling and display for various file types, and advanced chat interface features mirroring WhatsApp Web. Group messaging properly handles group IDs and participant restrictions.

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

## Recent Updates
- **2025-08-04**: Implemented persistent authentication system that survives application restarts:
  - Added PostgreSQL-backed session storage using connect-pg-simple
  - Created sessions table with proper indexing for efficient management
  - Configured 30-day session expiration with rolling renewal on activity
  - Implemented secure session configuration with httpOnly and sameSite measures
  - User sessions now persist across unlimited application restarts on the same device
  - Sessions automatically save to database with comprehensive user information storage

- **2025-08-04**: Migration to Replit environment completed with critical fixes:
  - Fixed signup form validation by properly combining country code with phone number
  - Enhanced chat message display to show saved contact names instead of user IDs or phone numbers
  - Improved contact name resolution in group messages using WhatsApp's contact list
  - Added fallback phone number formatting for better readability
  - Fixed Express session type interface to include all required user properties
  - Application successfully running with database integration and WhatsApp connectivity