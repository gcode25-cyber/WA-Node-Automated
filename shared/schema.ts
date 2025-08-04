import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Sessions table for persistent authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  whatsappNumber: text("whatsapp_number"),
  password: text("password").notNull(),
  isEmailVerified: boolean("is_email_verified").default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const whatsappSessions = pgTable("whatsapp_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  loginTime: timestamp("login_time").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sessionData: text("session_data"),
});

export const whatsappAccounts = pgTable("whatsapp_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  loginTime: timestamp("login_time").notNull(),
  sessionData: text("session_data"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const contactGroups = pgTable("contact_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  totalContacts: integer("total_contacts").default(0).notNull(),
  validContacts: integer("valid_contacts").default(0).notNull(),
  invalidContacts: integer("invalid_contacts").default(0).notNull(),
  duplicateContacts: integer("duplicate_contacts").default(0).notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const contactGroupMembers = pgTable("contact_group_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => contactGroups.id, { onDelete: "cascade" }),
  phoneNumber: text("phone_number").notNull(),
  name: text("name"),
  status: varchar("status", { enum: ["valid", "invalid", "duplicate"] }).default("valid").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const bulkMessageCampaigns = pgTable("bulk_message_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  contactGroupId: varchar("contact_group_id").notNull().references(() => contactGroups.id),
  message: text("message").notNull(),
  mediaUrl: text("media_url"),
  scheduledAt: timestamp("scheduled_at"),
  status: varchar("status", { enum: ["draft", "scheduled", "running", "completed", "failed"] }).default("draft").notNull(),
  sentCount: integer("sent_count").default(0).notNull(),
  failedCount: integer("failed_count").default(0).notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  isEmailVerified: true,
});

export const loginSchema = z.object({
  usernameOrEmail: z.string().min(1, "Username or Email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  rememberMe: z.boolean().optional(),
});

export const signupSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  username: z.string().min(1, "Username is required"),
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  phone: z.string().min(1, "Phone number is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
  acceptTerms: z.boolean().refine(val => val === true, "You must accept the terms and conditions"),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const insertWhatsappSessionSchema = createInsertSchema(whatsappSessions).omit({
  id: true,
});

export const insertWhatsappAccountSchema = createInsertSchema(whatsappAccounts).omit({
  id: true,
  createdAt: true,
});

export const insertContactGroupSchema = createInsertSchema(contactGroups).omit({
  id: true,
  createdAt: true,
  totalContacts: true,
  validContacts: true,
  invalidContacts: true,
  duplicateContacts: true,
});

export const insertContactGroupMemberSchema = createInsertSchema(contactGroupMembers).omit({
  id: true,
  createdAt: true,
});

export const insertBulkMessageCampaignSchema = createInsertSchema(bulkMessageCampaigns).omit({
  id: true,
  createdAt: true,
  sentCount: true,
  failedCount: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type LoginRequest = z.infer<typeof loginSchema>;
export type SignupRequest = z.infer<typeof signupSchema>;
export type WhatsappSession = typeof whatsappSessions.$inferSelect;
export type InsertWhatsappSession = z.infer<typeof insertWhatsappSessionSchema>;
export type WhatsappAccount = typeof whatsappAccounts.$inferSelect;
export type InsertWhatsappAccount = z.infer<typeof insertWhatsappAccountSchema>;
export type ContactGroup = typeof contactGroups.$inferSelect;
export type InsertContactGroup = z.infer<typeof insertContactGroupSchema>;
export type ContactGroupMember = typeof contactGroupMembers.$inferSelect;
export type InsertContactGroupMember = z.infer<typeof insertContactGroupMemberSchema>;
export type BulkMessageCampaign = typeof bulkMessageCampaigns.$inferSelect;
export type InsertBulkMessageCampaign = z.infer<typeof insertBulkMessageCampaignSchema>;

// API Response types
export const sessionInfoSchema = z.object({
  isAuthenticated: z.boolean(),
  user: z.object({
    name: z.string(),
    loginTime: z.string(),
  }).optional(),
});

export const qrResponseSchema = z.object({
  qr: z.string().optional(),
  error: z.string().optional(),
});



export const sendMessageSchema = z.object({
  phoneNumber: z.string().min(1, "Phone number is required"),
  message: z.string().min(1, "Message is required").max(1000, "Message too long"),
});

export const sendMediaMessageSchema = z.object({
  phoneNumber: z.string().min(1, "Phone number is required"),
  message: z.string().max(1000, "Message too long").optional(),
  // Note: media file will be handled separately as FormData
});

export const bulkMessageSchema = z.object({
  campaignName: z.string().min(1, "Campaign name is required"),
  contactGroupId: z.string().min(1, "Contact group is required"),
  message: z.string().min(1, "Message is required").max(1000, "Message too long"),
  scheduledAt: z.string().optional(),
});

export type SessionInfo = z.infer<typeof sessionInfoSchema>;
export type QRResponse = z.infer<typeof qrResponseSchema>;
export type SendMessageRequest = z.infer<typeof sendMessageSchema>;
export type SendMediaMessageRequest = z.infer<typeof sendMediaMessageSchema>;
export type BulkMessageRequest = z.infer<typeof bulkMessageSchema>;
