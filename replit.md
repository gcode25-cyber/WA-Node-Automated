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

- **2025-08-04**: Enhanced session persistence and contact filtering:
  - Implemented robust WhatsApp session persistence across page refreshes
  - Enhanced session restoration logic to maintain authentication state
  - Fixed contact filtering to only display saved contacts (isMyContact = true)
  - Improved contact name resolution in chat messages using WhatsApp contact data
  - Fixed WebSocket connection URL construction for proper Replit domain handling
  - Added session storage mechanisms to database for better persistence

- **2025-08-04**: Completed comprehensive session persistence system:
  - Successfully implemented true session persistence that survives application restarts
  - Fixed Chrome user data directory to use persistent storage instead of temporary folders
  - Added session backup markers and validation before showing QR codes
  - Enhanced reconnection logic with session file preservation capabilities
  - Confirmed working: WhatsApp automatically authenticates without QR codes after restart
  - Data restoration verified: 469 contacts, 8 chats, 3 groups sync automatically
  - System now provides seamless WhatsApp Web integration with full session continuity

- **2025-08-05**: Successfully completed migration to Replit environment:
  - Resolved package dependencies and TypeScript configuration for Replit compatibility
  - Created PostgreSQL database with complete schema migration using Drizzle
  - Fixed application startup with proper database connection and session storage
  - Confirmed working: WhatsApp Web integration with 376 contacts, 8 chats, 3 groups
  - Enhanced UI with loading states for CSV import and contact deletion operations
  - Application fully functional with real-time WebSocket connections and data synchronization

- **2025-08-05**: Fixed contact group persistence issue:
  - Identified and resolved contact group storage problem that caused data loss on restarts
  - Confirmed DatabaseStorage implementation was correctly configured for persistent storage
  - Fixed missing bulk operation methods in MemStorage interface implementation
  - Verified contact groups now properly persist to PostgreSQL database across application restarts
  - Contact group creation, retrieval, and member management fully functional with database persistence

- **2025-08-05**: Enhanced contact group interface layout:
  - Moved "Select All" checkbox above the contact list for better usability
  - Restructured table columns to proper order: checkbox, ID, name, phone number, status
  - Implemented center-aligned table layout with proper spacing distribution
  - Enhanced visual hierarchy and user experience in contact group management interface

- **2025-08-05**: Removed Status module per user request:
  - Removed Status navigation item from dashboard sidebar
  - Deleted Status page component and route
  - Removed Status API endpoint and WhatsApp status fetching method
  - Cleaned up all Status-related code from codebase
  - Status module will be re-implemented later with different requirements

- **2025-08-05**: Implemented contact selection and group assignment feature:
  - Added checkbox functionality to personal contacts module with "Select All" option above the contact list
  - Created "Add to Contact Groups" button that enables when contacts are selected
  - Implemented popup modal for selecting target contact groups with checkboxes
  - Added API endpoint `/api/contacts/add-to-groups` for bulk contact-to-group assignment
  - Feature allows copying selected contacts to multiple contact groups simultaneously
  - Enhanced UI follows same design pattern as contact groups module for consistency

- **2025-08-05**: Successfully migrated from Replit Agent to Replit environment:
  - Fixed database configuration from Neon serverless to standard PostgreSQL with proper drivers
  - Updated WhatsApp service to use node-postgres instead of Neon for database connections
  - Enhanced real-time disconnection detection with proactive connection monitoring
  - Improved error handling for messaging when WhatsApp is disconnected
  - Added automatic phone logout detection that updates UI status immediately
  - Implemented user-friendly error messages for connection issues during message sending
  - Application now provides real-time feedback when users log out from their phone
  
- **2025-08-05**: Implemented proper data sorting throughout the application:
  - Contacts are now sorted alphabetically (A-Z) by name for consistent navigation
  - Chats and groups are sorted by latest activity (newest first) for better UX
  - Sorting is maintained during real-time data synchronization and WebSocket updates
  - Enhanced server-side sorting ensures consistent ordering across all client displays
  - Fixed date format to DD/MM/YYYY format for better localization
  - Corrected timestamp conversion and link overflow issues in message display

- **2025-08-05**: Fixed contact deduplication and filtering to show all saved WhatsApp contacts:
  - Resolved issue where only one phone number per contact name was displayed
  - Updated backend filtering to be more inclusive of all saved WhatsApp contacts  
  - Removed restrictive phone number validation that was excluding valid international numbers
  - Enhanced contact deduplication to preserve multiple phone numbers for same person
  - Eliminated server-side deduplication that was reducing contacts from 6,845 to 2,994
  - Removed frontend phone number validation that was filtering out valid contacts
  - System now successfully displays all 6,845 saved contacts from WhatsApp Web
  - Added detailed logging to track contact filtering statistics for debugging

- **2025-08-05**: Implemented phone number validation to filter out invalid contacts:
  - Added validation logic to reject phone numbers with 15+ digits (like "266923761758368")
  - Filtered out numbers shorter than 7 digits to exclude invalid entries
  - Successfully removed 2,293 invalid phone numbers from 6,845 total contacts
  - Final contact count: 4,552 valid contacts with proper phone number formatting
  - Enhanced logging to show validation statistics and filtered contact counts

- **2025-08-06**: Successfully completed migration from Replit Agent to standard Replit environment:
  - Installed all required Node.js packages and dependencies automatically
  - Created PostgreSQL database with proper environment variables configuration
  - Deployed complete database schema using Drizzle migrations
  - Fixed WhatsApp Web integration with session persistence working correctly
  - Application successfully running on port 5000 with real-time WebSocket connections
  - All core features functional: contact management, messaging, groups, campaigns
  - Project now ready for development and deployment in standard Replit environment