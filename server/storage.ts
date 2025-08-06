import { 
  type User, type InsertUser, 
  type WhatsappSession, type InsertWhatsappSession,
  type ContactGroup, type InsertContactGroup,
  type ContactGroupMember, type InsertContactGroupMember,
  type BulkMessageCampaign, type InsertBulkMessageCampaign,
  users, whatsappSessions, contactGroups, contactGroupMembers, bulkMessageCampaigns
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

export interface IStorage {
  // Authentication methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  authenticateUser(usernameOrEmail: string, password: string): Promise<User | null>;
  
  // WhatsApp session methods
  getActiveSession(): Promise<WhatsappSession | undefined>;
  getActiveSessions(): Promise<WhatsappSession[]>;
  saveSession(session: InsertWhatsappSession): Promise<WhatsappSession>;
  createSession(session: InsertWhatsappSession): Promise<WhatsappSession>;
  updateSession(id: string, updates: Partial<WhatsappSession>): Promise<WhatsappSession | undefined>;
  deactivateSession(id: string): Promise<void>;
  clearAllSessions(): Promise<void>;
  
  // Contact group methods
  getContactGroups(): Promise<ContactGroup[]>;
  getContactGroup(id: string): Promise<ContactGroup | undefined>;
  createContactGroup(group: InsertContactGroup): Promise<ContactGroup>;
  updateContactGroup(id: string, updates: Partial<ContactGroup>): Promise<ContactGroup | undefined>;
  deleteContactGroup(id: string): Promise<void>;
  
  // Contact group member methods
  getContactGroupMembers(groupId: string): Promise<ContactGroupMember[]>;
  createContactGroupMember(member: InsertContactGroupMember): Promise<ContactGroupMember>;
  createContactGroupMembersBulk(members: InsertContactGroupMember[]): Promise<ContactGroupMember[]>;
  deleteContactGroupMembers(groupId: string): Promise<void>;
  deleteContactGroupMember(memberId: string): Promise<void>;
  deleteContactGroupMembersBulk(memberIds: string[]): Promise<void>;
  
  // Bulk message campaign methods
  getBulkMessageCampaigns(): Promise<BulkMessageCampaign[]>;
  createBulkMessageCampaign(campaign: InsertBulkMessageCampaign): Promise<BulkMessageCampaign>;
  updateBulkMessageCampaign(id: string, updates: Partial<BulkMessageCampaign>): Promise<BulkMessageCampaign | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private whatsappSessions: Map<string, WhatsappSession>;
  private contactGroups: Map<string, ContactGroup>;
  private contactGroupMembers: Map<string, ContactGroupMember>;
  private bulkMessageCampaigns: Map<string, BulkMessageCampaign>;

  constructor() {
    this.users = new Map();
    this.whatsappSessions = new Map();
    this.contactGroups = new Map();
    this.contactGroupMembers = new Map();
    this.bulkMessageCampaigns = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async authenticateUser(usernameOrEmail: string, password: string): Promise<User | null> {
    const user = Array.from(this.users.values()).find(
      (user) => (user.username === usernameOrEmail || user.email === usernameOrEmail) && user.password === password
    );
    return user || null;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      phone: insertUser.phone || null,
      whatsappNumber: insertUser.whatsappNumber || null,
      isEmailVerified: false,
      createdAt: new Date(),

    };
    this.users.set(id, user);
    return user;
  }

  async getActiveSession(): Promise<WhatsappSession | undefined> {
    return Array.from(this.whatsappSessions.values()).find(
      (session) => session.isActive
    );
  }

  async getActiveSessions(): Promise<WhatsappSession[]> {
    return Array.from(this.whatsappSessions.values()).filter(
      (session) => session.isActive
    );
  }

  async saveSession(insertSession: InsertWhatsappSession): Promise<WhatsappSession> {
    return this.createSession(insertSession);
  }

  async createSession(insertSession: InsertWhatsappSession): Promise<WhatsappSession> {
    const id = randomUUID();
    const session: WhatsappSession = { 
      ...insertSession, 
      id,
      isActive: true,
      sessionData: insertSession.sessionData || null
    };
    this.whatsappSessions.set(id, session);
    return session;
  }

  async updateSession(id: string, updates: Partial<WhatsappSession>): Promise<WhatsappSession | undefined> {
    const session = this.whatsappSessions.get(id);
    if (!session) return undefined;
    
    const updatedSession = { ...session, ...updates };
    this.whatsappSessions.set(id, updatedSession);
    return updatedSession;
  }

  async deactivateSession(id: string): Promise<void> {
    const session = this.whatsappSessions.get(id);
    if (session) {
      session.isActive = false;
      this.whatsappSessions.set(id, session);
    }
  }

  async clearAllSessions(): Promise<void> {
    this.whatsappSessions.clear();
  }

  // Contact group methods
  async getContactGroups(): Promise<ContactGroup[]> {
    return Array.from(this.contactGroups.values());
  }

  async getContactGroup(id: string): Promise<ContactGroup | undefined> {
    return this.contactGroups.get(id);
  }

  async createContactGroup(insertGroup: InsertContactGroup): Promise<ContactGroup> {
    const id = randomUUID();
    const group: ContactGroup = { 
      ...insertGroup, 
      id,
      description: insertGroup.description || null,
      totalContacts: 0,
      validContacts: 0,
      invalidContacts: 0,
      duplicateContacts: 0,
      createdAt: new Date()
    };
    this.contactGroups.set(id, group);
    return group;
  }

  async updateContactGroup(id: string, updates: Partial<ContactGroup>): Promise<ContactGroup | undefined> {
    const group = this.contactGroups.get(id);
    if (!group) return undefined;
    
    const updatedGroup = { ...group, ...updates };
    this.contactGroups.set(id, updatedGroup);
    return updatedGroup;
  }

  async deleteContactGroup(id: string): Promise<void> {
    this.contactGroups.delete(id);
    // Also delete all members
    const members = Array.from(this.contactGroupMembers.values());
    members.forEach(member => {
      if (member.groupId === id) {
        this.contactGroupMembers.delete(member.id);
      }
    });
  }

  // Contact group member methods
  async getContactGroupMembers(groupId: string): Promise<ContactGroupMember[]> {
    return Array.from(this.contactGroupMembers.values())
      .filter(member => member.groupId === groupId);
  }

  async createContactGroupMember(insertMember: InsertContactGroupMember): Promise<ContactGroupMember> {
    const id = randomUUID();
    const member: ContactGroupMember = { 
      ...insertMember, 
      id,
      name: insertMember.name || null,
      status: insertMember.status || "valid",
      createdAt: new Date()
    };
    this.contactGroupMembers.set(id, member);
    return member;
  }

  async deleteContactGroupMembers(groupId: string): Promise<void> {
    const members = Array.from(this.contactGroupMembers.values());
    members.forEach(member => {
      if (member.groupId === groupId) {
        this.contactGroupMembers.delete(member.id);
      }
    });
  }

  async deleteContactGroupMember(memberId: string): Promise<void> {
    this.contactGroupMembers.delete(memberId);
  }

  async createContactGroupMembersBulk(insertMembers: InsertContactGroupMember[]): Promise<ContactGroupMember[]> {
    const members: ContactGroupMember[] = [];
    insertMembers.forEach(insertMember => {
      const id = randomUUID();
      const member: ContactGroupMember = { 
        ...insertMember, 
        id,
        name: insertMember.name || null,
        status: insertMember.status || "valid",
        createdAt: new Date()
      };
      this.contactGroupMembers.set(id, member);
      members.push(member);
    });
    return members;
  }

  async deleteContactGroupMembersBulk(memberIds: string[]): Promise<void> {
    memberIds.forEach(memberId => {
      this.contactGroupMembers.delete(memberId);
    });
  }

  // Bulk message campaign methods
  async getBulkMessageCampaigns(): Promise<BulkMessageCampaign[]> {
    return Array.from(this.bulkMessageCampaigns.values());
  }

  async createBulkMessageCampaign(insertCampaign: InsertBulkMessageCampaign): Promise<BulkMessageCampaign> {
    const id = randomUUID();
    const campaign: BulkMessageCampaign = { 
      ...insertCampaign, 
      id,
      status: insertCampaign.status || "draft",
      mediaUrl: insertCampaign.mediaUrl || null,
      mediaType: insertCampaign.mediaType || null,
      timePost: insertCampaign.timePost || null,
      contactGroupId: insertCampaign.contactGroupId || null,
      whatsappGroupId: insertCampaign.whatsappGroupId || null,
      scheduleHours: insertCampaign.scheduleHours || null,
      minInterval: insertCampaign.minInterval || 1,
      maxInterval: insertCampaign.maxInterval || 10,
      scheduleType: insertCampaign.scheduleType || "immediate",
      totalTargets: 0,
      lastExecuted: null,
      sentCount: 0,
      failedCount: 0,
      createdAt: new Date()
    };
    this.bulkMessageCampaigns.set(id, campaign);
    return campaign;
  }

  async updateBulkMessageCampaign(id: string, updates: Partial<BulkMessageCampaign>): Promise<BulkMessageCampaign | undefined> {
    const campaign = this.bulkMessageCampaigns.get(id);
    if (!campaign) return undefined;
    
    const updatedCampaign = { ...campaign, ...updates };
    this.bulkMessageCampaigns.set(id, updatedCampaign);
    return updatedCampaign;
  }
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async authenticateUser(usernameOrEmail: string, password: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(
      and(
        eq(users.password, password),
        // Check if the identifier matches either username or email
        usernameOrEmail.includes('@') 
          ? eq(users.email, usernameOrEmail)
          : eq(users.username, usernameOrEmail)
      )
    );
    return user || null;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getActiveSession(): Promise<WhatsappSession | undefined> {
    const [session] = await db
      .select()
      .from(whatsappSessions)
      .where(eq(whatsappSessions.isActive, true));
    return session || undefined;
  }

  async getActiveSessions(): Promise<WhatsappSession[]> {
    return await db
      .select()
      .from(whatsappSessions)
      .where(eq(whatsappSessions.isActive, true));
  }

  async saveSession(insertSession: InsertWhatsappSession): Promise<WhatsappSession> {
    return this.createSession(insertSession);
  }

  async createSession(insertSession: InsertWhatsappSession): Promise<WhatsappSession> {
    const [session] = await db
      .insert(whatsappSessions)
      .values(insertSession)
      .returning();
    return session;
  }

  async updateSession(id: string, updates: Partial<WhatsappSession>): Promise<WhatsappSession | undefined> {
    const [session] = await db
      .update(whatsappSessions)
      .set(updates)
      .where(eq(whatsappSessions.id, id))
      .returning();
    return session || undefined;
  }

  async deactivateSession(id: string): Promise<void> {
    await db
      .update(whatsappSessions)
      .set({ isActive: false })
      .where(eq(whatsappSessions.id, id));
  }

  async clearAllSessions(): Promise<void> {
    await db
      .update(whatsappSessions)
      .set({ isActive: false })
      .where(eq(whatsappSessions.isActive, true));
  }

  async getContactGroups(): Promise<ContactGroup[]> {
    return await db.select().from(contactGroups);
  }

  async getContactGroup(id: string): Promise<ContactGroup | undefined> {
    const [group] = await db
      .select()
      .from(contactGroups)
      .where(eq(contactGroups.id, id));
    return group || undefined;
  }

  async createContactGroup(insertGroup: InsertContactGroup): Promise<ContactGroup> {
    const [group] = await db
      .insert(contactGroups)
      .values(insertGroup)
      .returning();
    return group;
  }

  async updateContactGroup(id: string, updates: Partial<ContactGroup>): Promise<ContactGroup | undefined> {
    const [group] = await db
      .update(contactGroups)
      .set(updates)
      .where(eq(contactGroups.id, id))
      .returning();
    return group || undefined;
  }

  async deleteContactGroup(id: string): Promise<void> {
    await db.delete(contactGroups).where(eq(contactGroups.id, id));
  }

  async getContactGroupMembers(groupId: string): Promise<ContactGroupMember[]> {
    return await db
      .select()
      .from(contactGroupMembers)
      .where(eq(contactGroupMembers.groupId, groupId));
  }

  async createContactGroupMember(insertMember: InsertContactGroupMember): Promise<ContactGroupMember> {
    const [member] = await db
      .insert(contactGroupMembers)
      .values(insertMember)
      .returning();
    return member;
  }

  async createContactGroupMembersBulk(insertMembers: InsertContactGroupMember[]): Promise<ContactGroupMember[]> {
    if (insertMembers.length === 0) return [];
    return await db
      .insert(contactGroupMembers)
      .values(insertMembers)
      .returning();
  }

  async deleteContactGroupMembers(groupId: string): Promise<void> {
    await db
      .delete(contactGroupMembers)
      .where(eq(contactGroupMembers.groupId, groupId));
  }

  async deleteContactGroupMember(memberId: string): Promise<void> {
    await db
      .delete(contactGroupMembers)
      .where(eq(contactGroupMembers.id, memberId));
  }

  async deleteContactGroupMembersBulk(memberIds: string[]): Promise<void> {
    if (memberIds.length === 0) return;
    await db
      .delete(contactGroupMembers)
      .where(inArray(contactGroupMembers.id, memberIds));
  }

  async getBulkMessageCampaigns(): Promise<BulkMessageCampaign[]> {
    return await db.select().from(bulkMessageCampaigns);
  }

  async createBulkMessageCampaign(insertCampaign: InsertBulkMessageCampaign): Promise<BulkMessageCampaign> {
    const [campaign] = await db
      .insert(bulkMessageCampaigns)
      .values(insertCampaign)
      .returning();
    return campaign;
  }

  async updateBulkMessageCampaign(id: string, updates: Partial<BulkMessageCampaign>): Promise<BulkMessageCampaign | undefined> {
    const [campaign] = await db
      .update(bulkMessageCampaigns)
      .set(updates)
      .where(eq(bulkMessageCampaigns.id, id))
      .returning();
    return campaign || undefined;
  }
}

export const storage = new DatabaseStorage();
