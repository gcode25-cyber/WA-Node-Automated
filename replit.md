# WhatsApp Bulk Messaging Tool - Waziper Clone

## Overview
This project is a comprehensive WhatsApp bulk messaging platform inspired by Waziper, built with React and Node.js. Its primary purpose is to enable businesses to efficiently send bulk WhatsApp messages, manage contacts, create targeted campaigns, and automate customer interactions. The platform maintains integration with WhatsApp Web, aiming to provide a robust solution for marketing and communication needs, with a vision for a SaaS model featuring tiered pricing, free trials, and scalable message-volume-based plans.

## User Preferences
- Modern TypeScript/React development stack
- Database-first approach with Drizzle ORM
- Component-based UI with shadcn/ui
- Clean, maintainable code structure
- Successfully migrated from Replit Agent to standard Replit environment (January 2025)

## System Architecture
The application is built with a React frontend (TypeScript, Vite, TailwindCSS, shadcn/ui) and a Node.js backend (Express, TypeScript). Data is managed using PostgreSQL with Drizzle ORM. WhatsApp integration is handled via the `whatsapp-web.js` library, supporting QR code authentication, session persistence, and multiple WhatsApp accounts. Authentication is session-based. File storage utilizes the local file system with Multer.

**Core Features:**
- **Authentication:** User registration, login, and session management.
- **WhatsApp Integration:** QR code authentication, session persistence, multiple account support, real-time connection status.
- **Messaging:** Single and bulk message sending, media message support (images, videos, documents, audio), message scheduling, and advanced campaign management with options for target types (contact groups, local contacts, WhatsApp groups), scheduling (immediate, timed, odd/even hours), randomized delivery intervals, and real-time status monitoring.
- **Campaign Management:** Real-time progress tracking with visual progress bars, sent/remaining/failed message counts, campaign cloning and reusability, auto-refresh for active campaigns, WebSocket integration for live updates, and comprehensive campaign status management.
- **Contact Management:** Contact group creation, CSV import, validation, deduplication, group member management, and bulk contact-to-group assignment. Contacts are sorted alphabetically by name.
- **Data Export/Import:** Export chats, contacts, and group participants as CSV; import contacts from CSV.
- **Dashboard & Analytics:** System status monitoring, campaign tracking, message statistics, real-time notifications.
- **UI/UX:** Component-based UI with shadcn/ui for a consistent and modern design. Illustrations are used for login/signup and landing pages, and lazy loading is implemented for images. Chat interface mirrors WhatsApp Web features.
- **Technical Implementations:** WebSocket connections for real-time updates, comprehensive logout functionality, robust media handling and display, secure session configuration, server-side sorting for consistent data display, and real-time campaign progress broadcasting.

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