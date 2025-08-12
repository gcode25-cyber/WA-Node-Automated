import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { websocketManager, type WebSocketMessage } from "@/lib/websocket";
import { Send, MessageSquare, Users, Plus, Smartphone, Paperclip, X, Upload, FileText, Image, Video, Music, File, Download, Search, Clock, Phone, Trash2, BarChart3, UserCheck, ChevronDown, Loader2, User, Copy, Play, Pause, RotateCcw, LogOut } from "lucide-react";

import { useLocation } from "wouter";

interface Chat {
  id: string;
  name: string;
  isGroup: boolean;
  unreadCount: number;
  lastMessage: {
    body: string;
    timestamp: number;
    fromMe: boolean;
  } | null;
  timestamp: number;
}

interface Contact {
  id: string;
  name: string;
  number: string;
  isMyContact: boolean;
  isWAContact: boolean;
  profilePicUrl: string | null;
  isGroup: boolean;
}

interface Group {
  id: string;
  name: string;
  isGroup: boolean;
  unreadCount: number;
  lastMessage: {
    body: string;
    timestamp: number;
    fromMe: boolean;
  } | null;
  timestamp: number;
  participants: any[];
  isAdmin?: boolean;
  onlyAdminsCanMessage?: boolean;
}

interface ContactGroup {
  id: string;
  name: string;
  description: string | null;
  totalContacts: number;
  validContacts: number;
  invalidContacts: number;
  duplicateContacts: number;
  createdAt: string;
}

interface BulkCampaign {
  id: string;
  name: string;
  contactGroupId: string;
  message: string;
  status: string;
  sentCount: number;
  failedCount: number;
  totalTargets: number;
  createdAt: string;
}

// Country codes list
const countryCodes = [
  { code: "+1", country: "US/Canada", flag: "🇺🇸" },
  { code: "+91", country: "India", flag: "🇮🇳" },
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+49", country: "Germany", flag: "🇩🇪" },
  { code: "+33", country: "France", flag: "🇫🇷" },
  { code: "+61", country: "Australia", flag: "🇦🇺" },
  { code: "+81", country: "Japan", flag: "🇯🇵" },
  { code: "+86", country: "China", flag: "🇨🇳" },
  { code: "+7", country: "Russia", flag: "🇷🇺" },
  { code: "+55", country: "Brazil", flag: "🇧🇷" },
  { code: "+52", country: "Mexico", flag: "🇲🇽" },
  { code: "+34", country: "Spain", flag: "🇪🇸" },
  { code: "+39", country: "Italy", flag: "🇮🇹" },
  { code: "+31", country: "Netherlands", flag: "🇳🇱" },
  { code: "+41", country: "Switzerland", flag: "🇨🇭" },
  { code: "+46", country: "Sweden", flag: "🇸🇪" },
  { code: "+47", country: "Norway", flag: "🇳🇴" },
  { code: "+45", country: "Denmark", flag: "🇩🇰" },
  { code: "+358", country: "Finland", flag: "🇫🇮" },
  { code: "+82", country: "South Korea", flag: "🇰🇷" },
];

export default function Dashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  // Handle URL parameters for module selection
  const urlParams = new URLSearchParams(window.location.search);
  const moduleFromUrl = urlParams.get('module');
  
  // Navigation states
  const [selectedFeature, setSelectedFeature] = useState<'whatsapp' | 'rcs'>('whatsapp');
  const [selectedModule, setSelectedModule] = useState(moduleFromUrl || 'send-message');
  
  // Account panel state
  const [showAccountView, setShowAccountView] = useState(false);
  
  // Form states
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showQRCode, setShowQRCode] = useState(true); // Start with true since user is not connected
  
  // Contact Groups state
  const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false);
  const [showBulkMessageDialog, setShowBulkMessageDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [selectedContactGroup, setSelectedContactGroup] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [importingGroupId, setImportingGroupId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  // Enhanced campaign states
  const [newCampaignName, setNewCampaignName] = useState('');
  const [targetType, setTargetType] = useState('contact_group');
  const [selectedWhatsAppGroup, setSelectedWhatsAppGroup] = useState('');
  const [scheduleType, setScheduleType] = useState('immediate');
  const [timePost, setTimePost] = useState('');
  const [minInterval, setMinInterval] = useState(1);
  const [maxInterval, setMaxInterval] = useState(10);
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [scheduleHours, setScheduleHours] = useState<number[]>([]);
  
  // Contact selection dropdown state
  const [showContactsDropdown, setShowContactsDropdown] = useState(false);
  const [contactSearchTerm, setContactSearchTerm] = useState("");
  const contactsDropdownRef = useRef<HTMLDivElement>(null);
  
  // Contact selection states for adding to groups
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [showAddToGroupsDialog, setShowAddToGroupsDialog] = useState(false);
  const [selectedGroupsForAdd, setSelectedGroupsForAdd] = useState<Set<string>>(new Set());
  const [contactGroupMemberships, setContactGroupMemberships] = useState<Map<string, ContactGroup[]>>(new Map());
  
  // Chat deletion state
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  
  // Close contacts dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contactsDropdownRef.current && !contactsDropdownRef.current.contains(event.target as Node)) {
        setShowContactsDropdown(false);
        setContactSearchTerm("");
      }
    };
    
    if (showContactsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showContactsDropdown]);
  
  // Update field values for placeholder visibility
  const fieldValues = {
    phoneNumber,
    message,
    newGroupName,
    newGroupDescription,
    bulkMessage
  };

  // Fetch current session info
  const { data: sessionInfo } = useQuery<{
    name: string;
    loginTime: string;
  }>({
    queryKey: ['/api/session-info'],
    refetchInterval: 10000, // Check every 10 seconds
  });

  // Fetch QR code when needed
  const { data: qrData, refetch: refetchQR } = useQuery<{qr?: string | null}>({
    queryKey: ['/api/get-qr'],
    enabled: !sessionInfo, // Fetch when no session
    refetchInterval: !sessionInfo ? 5000 : false,
    retry: 3,
  });

  // Fetch contact groups
  const { data: contactGroups = [], isLoading: contactGroupsLoading } = useQuery<ContactGroup[]>({
    queryKey: ['/api/contact-groups'],
    refetchInterval: 30000,
  });

  // Fetch chats with real-time updates
  const { data: chats = [], isLoading: chatsLoading } = useQuery<Chat[]>({
    queryKey: ['/api/chats'],
    enabled: !!sessionInfo,
    refetchInterval: false, // Disable automatic refetch since we use WebSocket updates
    staleTime: Infinity, // Data is always fresh from WebSocket
  });

  // Fetch contacts with real-time updates
  const { data: contacts = [], isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
    enabled: !!sessionInfo,
    refetchInterval: false, // Disable automatic refetch since we use WebSocket updates
    staleTime: Infinity, // Data is always fresh from WebSocket
  });

  // Fetch groups with real-time updates
  const { data: groups = [], isLoading: groupsLoading } = useQuery<Group[]>({
    queryKey: ['/api/groups'],
    enabled: !!sessionInfo,
    refetchInterval: false, // Disable automatic refetch since we use WebSocket updates
    staleTime: Infinity, // Data is always fresh from WebSocket
  });

  // Fetch bulk campaigns with smart refresh based on active campaigns
  const { data: bulkCampaigns = [], isLoading: campaignsLoading } = useQuery<BulkCampaign[]>({
    queryKey: ['/api/bulk-campaigns'],
    refetchInterval: () => {
      // Refresh every 30 seconds for bulk campaigns
      return 30000;
    },
    refetchIntervalInBackground: true, // Keep refreshing even when tab is not focused
  });

  // Helper function to determine if a phone number is valid (more inclusive)
  const isValidPhoneNumber = (phoneNumber: string): boolean => {
    // Remove all non-digit characters
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    
    // More inclusive validation - just check basic phone number patterns
    // Valid phone numbers should have at least 7 digits and not be extremely long
    if (cleanNumber.length < 7 || cleanNumber.length > 15) {
      return false;
    }
    
    // Exclude obvious group IDs or invalid patterns
    // Group IDs typically have specific patterns or are very long
    if (cleanNumber.length > 15) {
      return false;
    }
    
    // Allow most numbers that look like phone numbers
    // This is more inclusive to capture international variations
    return true;
  };

  // Helper function to keep all contacts with valid phone numbers (no deduplication by name)
  const deduplicateContacts = (contactsList: Contact[]): Contact[] => {
    // Instead of deduplicating by name, only remove exact duplicates (same ID)
    const uniqueContacts = new Map<string, Contact>();
    
    contactsList.forEach(contact => {
      // Only add if not already present (based on unique ID)
      if (!uniqueContacts.has(contact.id)) {
        uniqueContacts.set(contact.id, contact);
      }
    });
    
    // Return all unique contacts, preserving multiple numbers for same person
    // Remove frontend filtering - backend already filters appropriately
    return Array.from(uniqueContacts.values());
  };

  // Helper function to filter and format contacts for dropdown
  const filteredContacts = deduplicateContacts(contacts).filter((contact: Contact) => 
    contact.isMyContact && // Only show saved contacts
    (contact.name.toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
     contact.number.includes(contactSearchTerm))
  );
  
  // Helper functions for contact selection in contacts module
  const handleContactCheckboxToggle = (contactId: string) => {
    setSelectedContacts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const handleSelectAllContacts = () => {
    const filteredContactIds = filteredContacts.map(contact => contact.id);
    
    if (selectedContacts.size === filteredContactIds.length) {
      // All are selected, unselect all
      setSelectedContacts(new Set());
    } else {
      // Not all are selected, select all
      setSelectedContacts(new Set(filteredContactIds));
    }
  };

  const handleAddToContactGroups = () => {
    setShowAddToGroupsDialog(true);
    setSelectedGroupsForAdd(new Set());
  };

  // Helper function to handle contact selection for messaging
  const handleContactSelect = (contact: Contact) => {
    // Extract the phone number without country code formatting
    const phoneNumber = contact.number.replace(/\D/g, ''); // Remove all non-digits
    
    // Try to determine country code from the number
    let extractedCountryCode = "+91"; // Default
    let extractedPhoneNumber = phoneNumber;
    
    // Check for common country codes
    if (phoneNumber.startsWith('91') && phoneNumber.length === 12) {
      extractedCountryCode = "+91";
      extractedPhoneNumber = phoneNumber.substring(2);
    } else if (phoneNumber.startsWith('1') && phoneNumber.length === 11) {
      extractedCountryCode = "+1";
      extractedPhoneNumber = phoneNumber.substring(1);
    } else if (phoneNumber.startsWith('44') && phoneNumber.length >= 11) {
      extractedCountryCode = "+44";
      extractedPhoneNumber = phoneNumber.substring(2);
    }
    // Add more country code detection as needed
    
    setCountryCode(extractedCountryCode);
    setPhoneNumber(extractedPhoneNumber);
    setShowContactsDropdown(false);
    setContactSearchTerm("");
  };

  // WebSocket connection for real-time updates using centralized manager
  useEffect(() => {
    const handleWebSocketMessage = (message: WebSocketMessage) => {
      switch (message.type) {
        case 'qr':
          // Show QR section and invalidate QR-related queries to fetch new QR
          setShowQRCode(true);
          queryClient.invalidateQueries({ queryKey: ['/api/get-qr'] });
          // Also trigger manual refetch to ensure QR displays immediately
          setTimeout(() => {
            refetchQR();
          }, 1000);
          break;
        case 'connected':
          // Invalidate session info when connected and refresh data
          queryClient.invalidateQueries({ queryKey: ['/api/session-info'] });
          queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
          queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
          queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
          break;
        case 'connection_status':
          // Handle robust real-time connection status updates (like WhatsApp Web)
          if (message.data?.isRealTime) {
            const isConnected = message.data.connected;
            const state = message.data.state;
            
            // Update session info query with real-time status
            if (isConnected && message.data.sessionInfo) {
              queryClient.setQueryData(['/api/session-info'], message.data.sessionInfo);
              
              // Refresh data when phone reconnects
              queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
              queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
              queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
            } else if (!isConnected) {
              // Clear session data when phone disconnects
              queryClient.setQueryData(['/api/session-info'], null);
              
              // Show QR code if session needs re-authentication
              if (state === 'UNPAIRED' || state === 'TIMEOUT') {
                queryClient.invalidateQueries({ queryKey: ['/api/get-qr'] });
              }
            }
            
            console.log(`📱 Real-time status: ${isConnected ? 'Phone Connected' : 'Phone Disconnected'} (${state})`);
          }
          break;
        case 'disconnected':
        case 'logout':
          // Invalidate all session-related queries
          queryClient.invalidateQueries({ queryKey: ['/api/session-info'] });
          queryClient.invalidateQueries({ queryKey: ['/api/get-qr'] });
          break;
        case 'chats_updated':
          // Update chats cache with real-time data or invalidate for fresh fetch
          if (message.data?.chats) {
            queryClient.setQueryData(['/api/chats'], message.data.chats);
          } else {
            // If no data provided, invalidate cache to trigger fresh fetch
            queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
          }
          break;
        case 'contacts_updated':
          // Update contacts cache with real-time data
          if (message.data?.contacts) {
            queryClient.setQueryData(['/api/contacts'], message.data.contacts);
          }
          break;
        case 'groups_updated':
          // Update groups cache with real-time data
          if (message.data?.groups) {
            queryClient.setQueryData(['/api/groups'], message.data.groups);
          }
          break;
        case 'new_message':
          // Refresh chat list when new message arrives to update last message and unread count
          queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
          console.log('🔄 New message received, refreshing chat list...');
          break;
        default:
          // Handle unknown message types gracefully
          if (message.type === 'chat_history_cleared') {
            queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
            console.log('🗑️ Chat history cleared, refreshing chat list...');
          }
          break;
      }
    };

    // Register event handler
    websocketManager.addEventHandler(handleWebSocketMessage);
    
    // Cleanup on unmount
    return () => {
      websocketManager.removeEventHandler(handleWebSocketMessage);
    };
  }, [queryClient]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (data: { phoneNumber: string; message: string; file?: File }) => {
      if (data.file) {
        // Send media message
        const formData = new FormData();
        formData.append('phoneNumber', data.phoneNumber);
        formData.append('message', data.message);
        formData.append('media', data.file);
        
        return fetch('/api/send-media-message', {
          method: 'POST',
          body: formData,
        }).then(res => {
          if (!res.ok) throw new Error('Failed to send media message');
          return res.json();
        });
      } else {
        // Send text message
        return apiRequest("/api/send-message", "POST", data);
      }
    },
    onSuccess: () => {
      toast({
        title: "Message Sent",
        description: selectedFile ? "Your media message has been sent successfully!" : "Your message has been sent successfully!",
      });
      setPhoneNumber("");
      setMessage("");
      setSelectedFile(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!sessionInfo) {
      toast({
        title: "Not Connected",
        description: "Please connect to WhatsApp first",
        variant: "destructive",
      });
      return;
    }

    if (!phoneNumber.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter phone number",
        variant: "destructive",
      });
      return;
    }

    if (!message.trim() && !selectedFile) {
      toast({
        title: "Missing Content",
        description: "Please enter a message or select a file to send",
        variant: "destructive",
      });
      return;
    }

    // Combine country code with phone number
    const fullPhoneNumber = phoneNumber.startsWith('+') ? phoneNumber.trim() : `${countryCode}${phoneNumber.trim()}`;
    
    sendMessageMutation.mutate({
      phoneNumber: fullPhoneNumber,
      message: message.trim(),
      file: selectedFile || undefined,
    });
  };

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  }, []);

  const removeSelectedFile = useCallback(() => {
    setSelectedFile(null);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
    }
  }, []);

  // Create Contact Group mutation
  const createContactGroupMutation = useMutation({
    mutationFn: (data: { name: string; description: string }) =>
      apiRequest("/api/contact-groups", "POST", data),
    onSuccess: () => {
      toast({
        title: "Contact Group Created",
        description: "Your contact group has been created successfully!",
      });
      setShowCreateGroupDialog(false);
      setNewGroupName("");
      setNewGroupDescription("");
      queryClient.invalidateQueries({ queryKey: ['/api/contact-groups'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create",
        description: error.message || "Failed to create contact group",
        variant: "destructive",
      });
    },
  });

  // Delete Contact Group mutation
  const deleteContactGroupMutation = useMutation({
    mutationFn: (groupId: string) => apiRequest(`/api/contact-groups/${groupId}`, "DELETE"),
    onSuccess: () => {
      toast({
        title: "Contact Group Deleted",
        description: "Contact group has been deleted successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/contact-groups'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Delete",
        description: error.message || "Failed to delete contact group",
        variant: "destructive",
      });
    },
  });

  // Send Bulk Campaign mutation
  const sendBulkCampaignMutation = useMutation({
    mutationFn: (campaignId: string) =>
      apiRequest(`/api/bulk-campaigns/${campaignId}/send`, "POST"),
    onSuccess: () => {
      toast({
        title: "Campaign Sent",
        description: "Your bulk messaging campaign has been sent successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/bulk-campaigns'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Campaign",
        description: error.message || "Failed to send bulk messaging campaign",
        variant: "destructive",
      });
    },
  });

  // Send messages directly to a contact group
  const sendContactGroupMutation = useMutation({
    mutationFn: (data: { groupId: string; message: string }) =>
      apiRequest(`/api/contact-groups/${data.groupId}/send`, "POST", { message: data.message }),
    onSuccess: () => {
      toast({
        title: "Messages Sent",
        description: "Bulk messages sent successfully!",
      });
      setShowBulkMessageDialog(false);
      setBulkMessage("");
      setSelectedContactGroup("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Messages",
        description: error.message || "Failed to send messages",
        variant: "destructive",
      });
    },
  });

  // Enhanced campaign creation mutation
  const createBulkCampaignMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/campaigns/create', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create campaign');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Campaign Created",
        description: "Campaign has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bulk-campaigns"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create Campaign",
        description: error.message || "Failed to create campaign.",
        variant: "destructive",
      });
    },
  });



  // Media file handler
  const handleMediaSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedMedia(file);
    }
  };

  // Enhanced campaign creation handler
  const handleCreateEnhancedCampaign = async () => {
    if (!newCampaignName.trim() || !bulkMessage.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide campaign name and message.",
        variant: "destructive",
      });
      return;
    }

    if (targetType === 'contact_group' && !selectedContactGroup) {
      toast({
        title: "Missing Target",
        description: "Please select a contact group.",
        variant: "destructive",
      });
      return;
    }

    if (targetType === 'whatsapp_group' && !selectedWhatsAppGroup) {
      toast({
        title: "Missing Target",
        description: "Please select a WhatsApp group.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('name', newCampaignName);
    formData.append('message', bulkMessage);
    formData.append('targetType', targetType);
    formData.append('scheduleType', scheduleType);
    formData.append('minInterval', minInterval.toString());
    formData.append('maxInterval', maxInterval.toString());

    if (targetType === 'contact_group') {
      formData.append('contactGroupId', selectedContactGroup);
    } else if (targetType === 'whatsapp_group') {
      formData.append('whatsappGroupId', selectedWhatsAppGroup);
    }

    if (scheduleType === 'scheduled' && timePost) {
      formData.append('timePost', timePost);
    }
    
    if (scheduleHours.length > 0) {
      formData.append('scheduleHours', JSON.stringify(scheduleHours));
    }

    if (selectedMedia) {
      formData.append('media', selectedMedia);
    }

    try {
      await createBulkCampaignMutation.mutateAsync(formData);
      
      // Reset form
      setNewCampaignName('');
      setBulkMessage('');
      setSelectedContactGroup('');
      setSelectedWhatsAppGroup('');
      setTargetType('contact_group');
      setScheduleType('immediate');
      setTimePost('');
      setMinInterval(1);
      setMaxInterval(10);
      setSelectedMedia(null);
      setScheduleHours([]);
      setShowBulkMessageDialog(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  // Campaign control functions
  const executeCampaign = async (campaignId: string) => {
    try {
      await apiRequest(`/api/campaigns/${campaignId}/execute`, "POST");
      toast({
        title: "Campaign Started",
        description: "Campaign execution has begun.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bulk-campaigns"] });
    } catch (error: any) {
      toast({
        title: "Failed to Start Campaign",
        description: error.message || "Failed to start campaign.",
        variant: "destructive",
      });
    }
  };

  const pauseCampaign = async (campaignId: string) => {
    try {
      await apiRequest(`/api/campaigns/${campaignId}/pause`, "POST");
      toast({
        title: "Campaign Paused",
        description: "Campaign has been paused.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bulk-campaigns"] });
    } catch (error: any) {
      toast({
        title: "Failed to Pause Campaign",
        description: error.message || "Failed to pause campaign.",
        variant: "destructive",
      });
    }
  };

  const resumeCampaign = async (campaignId: string) => {
    try {
      await apiRequest(`/api/campaigns/${campaignId}/resume`, "POST");
      toast({
        title: "Campaign Resumed",
        description: "Campaign has been resumed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bulk-campaigns"] });
    } catch (error: any) {
      toast({
        title: "Failed to Resume Campaign",
        description: error.message || "Failed to resume campaign.",
        variant: "destructive",
      });
    }
  };

  // Restart campaign function
  const restartCampaign = async (campaignId: string) => {
    try {
      await apiRequest(`/api/campaigns/${campaignId}/restart`, "POST");
      toast({
        title: "Campaign Restarted",
        description: "Campaign has been restarted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bulk-campaigns"] });
    } catch (error: any) {
      toast({
        title: "Failed to Restart Campaign",
        description: error.message || "Failed to restart campaign.",
        variant: "destructive",
      });
    }
  };

  // Delete campaign function
  const deleteCampaign = async (campaignId: string) => {
    try {
      await apiRequest(`/api/campaigns/${campaignId}`, "DELETE");
      toast({
        title: "Campaign Deleted",
        description: "Campaign has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bulk-campaigns"] });
    } catch (error: any) {
      toast({
        title: "Failed to Delete Campaign",
        description: error.message || "Failed to delete campaign.",
        variant: "destructive",
      });
    }
  };

  // Clone campaign function
  const cloneCampaign = (campaign: BulkCampaign) => {
    // Pre-fill the form with campaign data
    setNewCampaignName(`${campaign.name} (Copy)`);
    setBulkMessage(campaign.message);
    if (campaign.contactGroupId) {
      setSelectedContactGroup(campaign.contactGroupId);
      setTargetType('contact_group');
    }
    setScheduleType('immediate');
    setTimePost('');
    setMinInterval(1);
    setMaxInterval(10);
    setSelectedMedia(null);
    
    // Open the dialog
    setShowBulkMessageDialog(true);
    
    toast({
      title: "Campaign Cloned",
      description: "Campaign data has been loaded for editing. Review and create when ready.",
    });
  };

  // Import CSV mutation
  const importCsvMutation = useMutation({
    mutationFn: async ({ groupId, file }: { groupId: string; file: File }) => {
      setImportingGroupId(groupId); // Set the specific group being imported
      const formData = new FormData();
      formData.append('csv', file);
      const response = await fetch(`/api/contact-groups/${groupId}/import-csv`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to import CSV');
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: "CSV Imported Successfully",
        description: `Imported ${data.validContacts} valid contacts, ${data.invalidContacts} invalid, ${data.duplicateContacts} duplicates`,
      });
      setImportingGroupId(null); // Clear importing state
      // Invalidate all related queries including the specific group
      queryClient.invalidateQueries({ queryKey: ['/api/contact-groups'] });
      queryClient.invalidateQueries({ queryKey: [`/api/contact-groups/${variables.groupId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/contact-groups/${variables.groupId}/members`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Import CSV",
        description: error.message || "Failed to import CSV file",
        variant: "destructive",
      });
      setImportingGroupId(null); // Clear importing state on error
    },
  });

  // Handle CSV file upload
  const handleCSVUpload = (groupId: string, file: File) => {
    importCsvMutation.mutate({ groupId, file });
  };

  // Mutation for adding contacts to groups
  const addToGroupsMutation = useMutation({
    mutationFn: async ({ contactIds, groupIds }: { contactIds: string[]; groupIds: string[] }) => {
      return apiRequest('/api/contacts/add-to-groups', "POST", { contactIds, groupIds });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Contacts Added",
        description: `Successfully added ${selectedContacts.size} contact${selectedContacts.size !== 1 ? 's' : ''} to ${selectedGroupsForAdd.size} group${selectedGroupsForAdd.size !== 1 ? 's' : ''}.`,
      });
      setSelectedContacts(new Set());
      setSelectedGroupsForAdd(new Set());
      setShowAddToGroupsDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/contact-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/bulk-group-memberships"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error Adding Contacts",
        description: error.message || "Failed to add contacts to groups.",
        variant: "destructive",
      });
    },
  });

  // Handler for adding contacts to groups
  const handleAddContactsToGroups = () => {
    const contactIds = Array.from(selectedContacts);
    const groupIds = Array.from(selectedGroupsForAdd);
    addToGroupsMutation.mutate({ contactIds, groupIds });
  };

  // Mutation for removing contact from a group
  const removeFromGroupMutation = useMutation({
    mutationFn: async ({ contactId, groupId }: { contactId: string; groupId: string }) => {
      return apiRequest(`/api/contacts/${contactId}/remove-from-group/${groupId}`, "DELETE");
    },
    onSuccess: (data: any, variables) => {
      toast({
        title: "Contact Removed",
        description: `Contact removed from group successfully.`,
      });
      // Update local state to remove the group from contact's membership
      setContactGroupMemberships(prev => {
        const newMap = new Map(prev);
        const currentGroups = newMap.get(variables.contactId) || [];
        const updatedGroups = currentGroups.filter(group => group.id !== variables.groupId);
        if (updatedGroups.length > 0) {
          newMap.set(variables.contactId, updatedGroups);
        } else {
          newMap.delete(variables.contactId);
        }
        return newMap;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contact-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/bulk-group-memberships"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error Removing Contact",
        description: error.message || "Failed to remove contact from group.",
        variant: "destructive",
      });
    },
  });

  // Load contact group memberships using bulk endpoint
  const { data: bulkMemberships } = useQuery<Record<string, ContactGroup[]>>({
    queryKey: ['/api/contacts/bulk-group-memberships'],
    enabled: !contactsLoading && contacts && contacts.length > 0,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Process bulk memberships when data is available
  useEffect(() => {
    if (bulkMemberships && contacts && contacts.length > 0) {
      const membershipsMap = new Map<string, ContactGroup[]>();
      
      // Only process contacts that are "My Contacts"
      const myContacts = deduplicateContacts(contacts).filter(contact => contact.isMyContact);
      
      for (const contact of myContacts) {
        // Clean the contact number for matching (same logic as backend)
        let cleanNumber = contact.number.replace(/[^0-9+]/g, '');
        if (cleanNumber && !cleanNumber.startsWith('+') && cleanNumber.length === 10) {
          cleanNumber = '+91' + cleanNumber;
        }
        
        // Check if this contact has group memberships
        const groups = bulkMemberships[cleanNumber] || [];
        if (groups.length > 0) {
          membershipsMap.set(contact.id, groups);
        }
      }
      
      setContactGroupMemberships(membershipsMap);
    }
  }, [bulkMemberships, contacts, contactsLoading]);

  // Export all groups CSV
  const exportAllGroupsCSV = async () => {
    try {
      const response = await fetch('/api/groups/export-all-csv');
      if (!response.ok) throw new Error('Failed to export CSV files');
      
      const data = await response.json();
      
      if (!data.success || !data.files) {
        throw new Error('Invalid response format');
      }
      
      // Download each CSV file separately
      Object.entries(data.files).forEach(([filename, content]) => {
        const blob = new Blob([content as string], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      });
      
      toast({
        title: "CSVs Exported",
        description: `Successfully exported ${data.totalGroups} group CSV files!`,
      });
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export CSV files",
        variant: "destructive",
      });
    }
  };

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: () => apiRequest('/api/logout', 'POST'),
    onSuccess: () => {
      // Show QR code immediately and refresh data
      setShowQRCode(true);
      
      // Navigate to account view to show QR code
      setSelectedModule('account');
      setShowAccountView(true);
      
      // Clear session data from cache
      queryClient.setQueryData(['/api/session-info'], null);
      
      // Force refresh QR and other data
      queryClient.invalidateQueries({ queryKey: ['/api/get-qr'] });
      queryClient.invalidateQueries({ queryKey: ['/api/session-info'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      
      // Manually trigger QR fetch after a short delay
      setTimeout(() => {
        refetchQR();
      }, 2000);
      
      toast({
        title: "Logged Out",
        description: "Successfully logged out from WhatsApp. Scan QR to reconnect.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Logout Failed",
        description: error.message || "Failed to logout. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Auto refresh data every 60 seconds (automated resync)
  useEffect(() => {
    if (!sessionInfo) return;
    
    const autoRefreshInterval = setInterval(() => {
      // Silently refresh data in background
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
    }, 60000); // Every 60 seconds

    return () => clearInterval(autoRefreshInterval);
  }, [sessionInfo, queryClient]);

  // Show QR code when no session, hide when authenticated
  useEffect(() => {
    if (sessionInfo && showQRCode) {
      setShowQRCode(false);
    } else if (!sessionInfo) {
      // Auto-show QR when not connected
      setShowQRCode(true);
    }
  }, [sessionInfo, showQRCode]);

  const exportContactsCSV = async () => {
    try {
      const response = await fetch('/api/contacts/download');
      if (!response.ok) throw new Error('Failed to export CSV');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'whatsapp_contacts.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'CSV Exported',
        description: 'Contacts have been exported successfully!',
      });
    } catch (error: any) {
      toast({
        title: 'Export Failed',
        description: error.message || 'Failed to export CSV',
        variant: 'destructive',
      });
    }
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a group name",
        variant: "destructive",
      });
      return;
    }
    
    createContactGroupMutation.mutate({
      name: newGroupName.trim(),
      description: newGroupDescription.trim() || "",
    });
  };

  const handleSendBulkMessage = () => {
    if (!selectedContactGroup || !bulkMessage.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    sendContactGroupMutation.mutate({
      groupId: selectedContactGroup,
      message: bulkMessage.trim(),
    });
  };

  return (
    <>
      <div className="h-screen flex bg-gray-50 dark:bg-gray-900">
      {/* Left Sidebar - Features */}
      <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div 
            className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors cursor-pointer"
            onClick={() => {
              setShowAccountView(true);
              setSelectedModule('account');
            }}
            data-testid="button-account-panel"
          >
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              {sessionInfo?.name ? (
                <span className="text-white font-bold text-sm">
                  {sessionInfo.name.charAt(0).toUpperCase()}
                </span>
              ) : (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
            </div>
            <div className="flex-1 text-center ml-3">
              {sessionInfo ? (
                <div className="bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium max-w-full">
                  <div className="flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white mr-2 flex-shrink-0"></div>
                    <span className="truncate break-words">{sessionInfo.name}</span>
                  </div>
                </div>
              ) : (
                <Badge variant="secondary" className="text-sm px-3 py-1">
                  <div className="w-2 h-2 rounded-full mr-2 bg-gray-400"></div>
                  <span className="whitespace-nowrap">Not Connected</span>
                </Badge>
              )}
            </div>
          </div>
          
          {/* WhatsApp and RCS buttons - Show when not connected */}
          {!sessionInfo && (
            <div className="px-3 py-4 space-y-2">
              <div className="flex items-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <span className="font-medium ml-3">WhatsApp</span>
              </div>
              
              <div className="flex items-center p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                  <Smartphone className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="font-medium ml-3">RCS</span>
              </div>
            </div>
          )}
        </div>
        


        {/* Features List - Hide when QR is showing */}
        {sessionInfo && (
          <div className="flex-1 p-4 space-y-2">
            {/* WhatsApp Feature */}
            <div 
              className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                selectedFeature === 'whatsapp' 
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
              onClick={() => setSelectedFeature('whatsapp')}
            >
              <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <span className="font-medium ml-3">WhatsApp</span>
            </div>

            {/* RCS Feature */}
            <div 
              className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                selectedFeature === 'rcs' 
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
              onClick={() => setSelectedFeature('rcs')}
            >
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                <Smartphone className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="font-medium ml-3">RCS</span>
            </div>
          </div>
        )}
      </div>

      {/* Middle Sidebar - Modules */}
      {selectedFeature === 'whatsapp' && (
        <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          {/* Module Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">WhatsApp</h3>
          </div>
          
          {/* Modules List */}
          <div className="p-4 space-y-4">
            {/* Templates Section */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">TEMPLATES</h4>
              
              <div 
                className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedModule === 'button-template' 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => setSelectedModule('button-template')}
              >
                <div className="w-8 h-8 rounded-lg bg-pink-100 dark:bg-pink-900/20 flex items-center justify-center">
                  <span className="text-pink-600 dark:text-pink-400 text-sm">📱</span>
                </div>
                <div>
                  <div className="font-medium text-sm">Button template</div>
                  <div className="text-xs text-gray-500">Create interactive button messages</div>
                </div>
              </div>

              <div 
                className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedModule === 'poll-template' 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => setSelectedModule('poll-template')}
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 text-sm">📊</span>
                </div>
                <div>
                  <div className="font-medium text-sm">Poll template</div>
                  <div className="text-xs text-gray-500">Create Poll messages</div>
                </div>
              </div>

              <div 
                className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedModule === 'list-template' 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => setSelectedModule('list-template')}
              >
                <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                  <span className="text-orange-600 dark:text-orange-400 text-sm">📝</span>
                </div>
                <div>
                  <div className="font-medium text-sm">List message template</div>
                  <div className="text-xs text-gray-500">Create list of items/options</div>
                </div>
              </div>
            </div>

            {/* Contact Section */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">CONTACT</h4>
              
              <div 
                className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedModule === 'contacts' 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => setSelectedModule('contacts')}
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="font-medium text-sm">Contacts</div>
                  <div className="text-xs text-gray-500">Create, edit your contacts</div>
                </div>
              </div>
            </div>

            {/* Existing Modules */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">MESSAGING</h4>
              
              <div 
                className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedModule === 'send-message' 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => setSelectedModule('send-message')}
              >
                <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <Send className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div className="font-medium text-sm">Send Message</div>
              </div>

              <div 
                className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedModule === 'chats' 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => setSelectedModule('chats')}
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="font-medium text-sm">Chats</div>
              </div>

              <div 
                className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedModule === 'groups' 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => setSelectedModule('groups')}
              >
                <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div className="font-medium text-sm">Groups</div>
              </div>

              <div 
                className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedModule === 'contact-groups' 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => setSelectedModule('contact-groups')}
              >
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                  <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="font-medium text-sm">Contact Groups</div>
              </div>

              <div 
                className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedModule === 'bulk-messaging' 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => setSelectedModule('bulk-messaging')}
              >
                <div className="w-8 h-8 rounded-lg bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                  <Send className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="font-medium text-sm">Bulk Messaging</div>
              </div>



              {/* Reports Section */}
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-6 mb-2">REPORTS</h4>
              
              <div 
                className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedModule === 'reports' 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => setSelectedModule('reports')}
              >
                <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="font-medium text-sm">Reports</div>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* RCS Module */}
      {selectedFeature === 'rcs' && (
        <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white">RCS</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Rich Communication Services
            </p>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-900 flex flex-col">
        {selectedFeature === 'whatsapp' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Account View Module */}
            {selectedModule === 'account' && (
              <div className="p-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <User className="h-5 w-5" />
                      <span>WhatsApp Account</span>
                    </CardTitle>
                    <CardDescription>
                      Manage your WhatsApp connection and account settings
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {sessionInfo ? (
                      /* Connected Account View */
                      <div className="space-y-6">
                        {/* Account Info */}
                        <div className="flex items-center space-x-4 p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                            {sessionInfo.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xl font-semibold text-green-900 dark:text-green-100">
                              {sessionInfo.name}
                            </h3>
                            <div className="flex items-center text-green-700 dark:text-green-300 mt-1">
                              <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                              <span className="text-sm">Connected</span>
                            </div>
                            {sessionInfo.loginTime && (
                              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                                Connected: {new Date(sessionInfo.loginTime).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Account Actions */}
                        <div className="space-y-4">
                          <h4 className="text-lg font-medium">Account Actions</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Logout Button */}
                            <Button 
                              variant="destructive" 
                              onClick={() => logoutMutation.mutate()}
                              disabled={logoutMutation.isPending}
                              className="flex items-center space-x-2"
                              data-testid="button-logout-main"
                            >
                              {logoutMutation.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span>Logging out...</span>
                                </>
                              ) : (
                                <>
                                  <LogOut className="h-4 w-4" />
                                  <span>Logout</span>
                                </>
                              )}
                            </Button>
                            
                            {/* Additional actions can be added here */}
                            <Button 
                              variant="outline"
                              onClick={() => {
                                setSelectedModule('send-message');
                                setShowAccountView(false);
                              }}
                              className="flex items-center space-x-2"
                            >
                              <MessageSquare className="h-4 w-4" />
                              <span>Send Message</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* QR Code View for Connection */
                      <div className="space-y-6">
                        <div className="text-center">
                          <h3 className="text-lg font-semibold mb-2">Connect Your WhatsApp</h3>
                          <p className="text-muted-foreground mb-6">
                            Scan the QR code below with your WhatsApp mobile app to connect your account.
                          </p>
                        </div>

                        {/* QR Code Display */}
                        <div className="flex justify-center">
                          {qrData?.qr ? (
                            <div className="bg-white p-8 rounded-2xl shadow-xl border">
                              <img
                                src={qrData.qr.startsWith('data:') ? qrData.qr : `data:image/png;base64,${qrData.qr}`}
                                alt="QR Code for WhatsApp Authentication"
                                className="w-80 h-80 mx-auto rounded-xl"
                                loading="lazy"
                              />
                            </div>
                          ) : (
                            <div className="bg-white p-8 rounded-2xl shadow-xl border flex justify-center items-center w-96 h-96">
                              <div className="text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                                <p className="text-lg text-muted-foreground font-medium">Generating QR Code...</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Connection Status */}
                        <div className="flex items-center justify-center space-x-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-lg text-muted-foreground font-medium">QR Code Active</span>
                        </div>



                        {/* Instructions */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
                          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">How to connect:</h4>
                          <ol className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                            <li className="flex items-start">
                              <span className="font-medium mr-2">1.</span>
                              Open WhatsApp on your phone
                            </li>
                            <li className="flex items-start">
                              <span className="font-medium mr-2">2.</span>
                              Tap Menu (⋮) or Settings and select Linked Devices
                            </li>
                            <li className="flex items-start">
                              <span className="font-medium mr-2">3.</span>
                              Tap "Link a Device" and scan this QR code
                            </li>
                          </ol>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Send Message Module */}
            {selectedModule === 'send-message' && (
              <div className="p-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <MessageSquare className="h-5 w-5" />
                      <span>Send Single Message</span>
                    </CardTitle>
                    <CardDescription>
                      Send a message to any WhatsApp number using your connected WhatsApp
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Phone Number with Country Code */}
                    <div className="space-y-2">
                      <Label htmlFor="phone-number">Recipient Phone Number</Label>
                      <div className="flex space-x-2">
                        <Select value={countryCode} onValueChange={setCountryCode}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {countryCodes.map((country) => (
                              <SelectItem key={country.code} value={country.code}>
                                {country.flag} {country.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex-1 relative" ref={contactsDropdownRef}>
                          <Input
                            id="phone-number"
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                            className="w-full pr-12"
                          />
                          <Label 
                            htmlFor="phone-number" 
                            className={`absolute left-3 pointer-events-none transition-all duration-200 ${
                              fieldValues.phoneNumber
                                ? "hidden"
                                : "top-3 text-sm text-gray-500 dark:text-gray-400"
                            }`}
                          >
                            1234567890
                          </Label>
                          
                          {/* Contacts Button */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={() => setShowContactsDropdown(!showContactsDropdown)}
                            disabled={!sessionInfo || contacts.length === 0}
                          >
                            <UserCheck className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          </Button>
                          
                          {/* Contacts Dropdown */}
                          {showContactsDropdown && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-64 overflow-hidden">
                              {/* Search Input */}
                              <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                  <Input
                                    placeholder="Search contacts..."
                                    value={contactSearchTerm}
                                    onChange={(e) => setContactSearchTerm(e.target.value)}
                                    className="pl-10 h-8"
                                  />
                                </div>
                              </div>
                              
                              {/* Contacts List */}
                              <div className="max-h-48 overflow-y-auto">
                                {filteredContacts.length === 0 ? (
                                  <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                                    {contactSearchTerm ? 'No contacts found' : 'No saved contacts available'}
                                  </div>
                                ) : (
                                  filteredContacts.map((contact: Contact) => (
                                    <button
                                      key={contact.id}
                                      onClick={() => handleContactSelect(contact)}
                                      className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 flex items-center space-x-3"
                                    >
                                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                        <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium text-gray-900 dark:text-white truncate">
                                          {contact.name}
                                        </div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                          {contact.number}
                                        </div>
                                      </div>
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Select country code and enter phone number (numbers only)
                      </p>
                    </div>

                    {/* Message */}
                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <div className="relative">
                        <Textarea
                          id="message"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          rows={4}
                        />
                        <Label 
                          htmlFor="message" 
                          className={`absolute left-3 top-3 pointer-events-none transition-all duration-200 ${
                            fieldValues.message
                              ? "hidden"
                              : "text-sm text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          Enter your message here... (optional if sending media)
                        </Label>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {message.length}/1000 characters
                      </p>
                    </div>

                    {/* File Upload with Drag & Drop */}
                    <div className="space-y-2">
                      <Label htmlFor="file-upload">Media Attachment (Optional)</Label>
                      <div
                        className={`border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer ${
                          isDragOver 
                            ? 'border-primary bg-primary/5' 
                            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => !selectedFile && document.getElementById('file-upload')?.click()}
                      >
                        <input
                          id="file-upload"
                          type="file"
                          accept="image/*,video/*,audio/*,.pdf,.txt,.docx,.xlsx,.pptx,.doc,.xls,.ppt,.html,.epub,.ods,.zip,.json"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        {selectedFile ? (
                          <div className="text-center space-y-2">
                            <File className="h-8 w-8 text-primary mx-auto" />
                            <p className="text-sm font-medium text-foreground">
                              {selectedFile.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {(selectedFile.size / 1024 / 1024).toFixed(2)}MB
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={removeSelectedFile}
                            >
                              Remove
                            </Button>
                          </div>
                        ) : (
                          <div className="text-center">
                            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground mb-1">
                              <span className="text-primary">Click to upload</span>
                              {" "}or drag and drop
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Images, Videos, Audio, PDF, Documents (max 16MB)
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Send Button */}
                    <Button
                      onClick={handleSendMessage}
                      disabled={sendMessageMutation.isPending || !sessionInfo || !phoneNumber.trim() || (!message.trim() && !selectedFile)}
                      className="w-full"
                    >
                      {sendMessageMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Send Message
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Template Modules */}
            {selectedModule === 'button-template' && (
              <div className="p-6">
                <Card>
                    <CardHeader>
                      <CardTitle>Button Template</CardTitle>
                      <CardDescription>Create interactive button messages (Coming Soon)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center p-8">
                        <span className="text-4xl mb-4 block">📱</span>
                        <h3 className="text-lg font-semibold mb-2">Button Template</h3>
                        <p className="text-muted-foreground">
                          This feature will allow you to create interactive button messages for enhanced user engagement.
                        </p>
                      </div>
                    </CardContent>
                </Card>
              </div>
            )}

            {selectedModule === 'poll-template' && (
              <div className="p-6">
                <Card>
                    <CardHeader>
                      <CardTitle>Poll Template</CardTitle>
                      <CardDescription>Create Poll messages (Coming Soon)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center p-8">
                        <span className="text-4xl mb-4 block">📊</span>
                        <h3 className="text-lg font-semibold mb-2">Poll Template</h3>
                        <p className="text-muted-foreground">
                          This feature will allow you to create poll messages to gather feedback from your contacts.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

            {selectedModule === 'list-template' && (
              <div className="p-6">
                <Card>
                    <CardHeader>
                      <CardTitle>List Message Template</CardTitle>
                      <CardDescription>Create list of items/options (Coming Soon)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center p-8">
                        <span className="text-4xl mb-4 block">📝</span>
                        <h3 className="text-lg font-semibold mb-2">List Message Template</h3>
                        <p className="text-muted-foreground">
                          This feature will allow you to create structured list messages with multiple options.
                        </p>
                      </div>
                    </CardContent>
                </Card>
              </div>
            )}

            {selectedModule === 'contacts' && (
                <div className="flex flex-col h-full">
                  {/* Sticky Header */}
                  <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 p-6 pb-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Phone className="h-5 w-5" />
                        <span className="text-lg font-semibold">WhatsApp Contacts</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button 
                          onClick={handleAddToContactGroups}
                          disabled={!sessionInfo || selectedContacts.size === 0}
                          variant="outline"
                          size="sm"
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Add to Contact Groups
                        </Button>
                        <Button 
                          onClick={exportContactsCSV}
                          disabled={!sessionInfo || contacts.length === 0}
                          size="sm"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export CSV
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Your WhatsApp contacts from connected device
                    </p>
                    
                    {/* Controls */}
                    {sessionInfo && contacts.length > 0 && (
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="select-all-contacts"
                            checked={
                              filteredContacts.length > 0 &&
                              selectedContacts.size === filteredContacts.length
                            }
                            onCheckedChange={handleSelectAllContacts}
                            data-testid="checkbox-select-all-contacts"
                          />
                          <label 
                            htmlFor="select-all-contacts" 
                            className="text-sm font-medium cursor-pointer"
                          >
                            Select All ({filteredContacts.length} contacts)
                          </label>
                        </div>
                        
                        {/* Search Bar */}
                        <div className="relative max-w-md flex-1">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="Search contacts..."
                            value={contactSearchTerm}
                            onChange={(e) => setContactSearchTerm(e.target.value)}
                            className="pl-10"
                            data-testid="input-search-contacts"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto p-6 pr-2 min-h-0">
                    {!sessionInfo ? (
                      <div className="text-center p-8">
                        <Phone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Connect WhatsApp</h3>
                        <p className="text-muted-foreground">
                          Please connect to WhatsApp first to view your contacts.
                        </p>
                      </div>
                    ) : contactsLoading ? (
                      <div className="text-center p-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                        <p className="mt-4 text-muted-foreground">Loading contacts...</p>
                      </div>
                    ) : contacts.length === 0 ? (
                      <div className="text-center p-8">
                        <Phone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No Contacts Found</h3>
                        <p className="text-muted-foreground">
                          Your WhatsApp contacts will appear here once they are synced.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Contacts List */}
                        {filteredContacts.length === 0 ? (
                          <div className="text-center p-8">
                            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No contacts found</h3>
                            <p className="text-muted-foreground">
                              {contactSearchTerm ? `No contacts match "${contactSearchTerm}"` : "No contacts available"}
                            </p>
                          </div>
                        ) : (
                          filteredContacts.map((contact: Contact) => (
                            <div key={contact.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <Checkbox
                                    id={`contact-${contact.id}`}
                                    checked={selectedContacts.has(contact.id)}
                                    onCheckedChange={() => handleContactCheckboxToggle(contact.id)}
                                    data-testid={`checkbox-contact-${contact.id}`}
                                  />
                                  <div className="w-10 h-10 rounded-full bg-blue-200 dark:bg-blue-700 flex items-center justify-center">
                                    <Phone className="h-5 w-5" />
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-semibold">{contact.name}</h4>
                                    <p className="text-sm text-muted-foreground">
                                      {contact.number}
                                    </p>
                                    {/* Contact Group Tags */}
                                    {contactGroupMemberships.get(contact.id) && contactGroupMemberships.get(contact.id)!.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {contactGroupMemberships.get(contact.id)!.map((group) => (
                                          <Badge 
                                            key={group.id} 
                                            variant="secondary" 
                                            className="text-xs flex items-center gap-1 pr-1"
                                          >
                                            <span>{group.name}</span>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                removeFromGroupMutation.mutate({ 
                                                  contactId: contact.number, 
                                                  groupId: group.id 
                                                });
                                              }}
                                              className="ml-1 hover:bg-red-200 dark:hover:bg-red-800 rounded-full p-0.5 transition-colors"
                                              data-testid={`button-remove-${contact.id}-from-${group.id}`}
                                              disabled={removeFromGroupMutation.isPending}
                                            >
                                              <X className="h-3 w-3" />
                                            </button>
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setLocation(`/chat/${contact.id}`)}
                                    data-testid={`button-chat-${contact.id}`}
                                  >
                                    <MessageSquare className="h-4 w-4 mr-1" />
                                    Chat
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}



            {/* Contact Groups Module */}
            {selectedModule === 'contact-groups' && (
              <div className="p-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Users className="h-5 w-5" />
                        <span>Contact Groups</span>
                      </div>
                      <Button 
                        onClick={() => setShowCreateGroupDialog(true)}
                        disabled={!sessionInfo}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Group
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      Manage your contact groups for bulk messaging campaigns
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {contactGroupsLoading ? (
                      <div className="text-center p-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                        <p className="mt-4 text-muted-foreground">Loading contact groups...</p>
                      </div>
                    ) : contactGroups.length === 0 ? (
                      <div className="text-center p-8">
                        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No Contact Groups</h3>
                        <p className="text-muted-foreground mb-4">
                          Create your first contact group to start organizing your contacts for bulk messaging.
                        </p>
                        <Button onClick={() => setShowCreateGroupDialog(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Create First Group
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {contactGroups.map((group: ContactGroup) => (
                          <div key={group.id} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-semibold">{group.name}</h4>
                                {group.description && (
                                  <p className="text-sm text-muted-foreground">{group.description}</p>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="file"
                                  accept=".csv"
                                  className="hidden"
                                  id={`csv-upload-${group.id}`}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleCSVUpload(group.id, file);
                                  }}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setLocation(`/group-contacts/${group.id}`)}
                                  className="flex items-center space-x-2"
                                >
                                  <Users className="h-4 w-4" />
                                  <span>Show</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => document.getElementById(`csv-upload-${group.id}`)?.click()}
                                  disabled={importingGroupId === group.id}
                                  className="flex items-center space-x-2"
                                >
                                  {importingGroupId === group.id ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      <span>Importing...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="h-4 w-4" />
                                      <span>Import</span>
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(`/api/contact-groups/${group.id}/export`)}
                                  className="flex items-center space-x-2"
                                >
                                  <Download className="h-4 w-4" />
                                  <span>Export</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => deleteContactGroupMutation.mutate(group.id)}
                                  disabled={deleteContactGroupMutation.isPending}
                                  className="flex items-center space-x-2"
                                >
                                  {deleteContactGroupMutation.isPending ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      <span>Deleting...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 className="h-4 w-4" />
                                      <span>Delete</span>
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                              <span>Total: {group.totalContacts}</span>
                              <span>Valid: {group.validContacts}</span>
                              <span>Invalid: {group.invalidContacts}</span>
                              <span>Duplicates: {group.duplicateContacts}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                </div>
              )}

            {/* Enhanced Bulk Messaging Module */}
            {selectedModule === 'bulk-messaging' && (
              <div className="p-6 space-y-6 overflow-y-auto max-h-screen">
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight">Bulk Messaging</h1>
                    <p className="text-muted-foreground">Create and manage bulk messaging campaigns</p>
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={showBulkMessageDialog} onOpenChange={setShowBulkMessageDialog}>
                      <DialogTrigger asChild>
                        <Button disabled={!sessionInfo}>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Campaign
                        </Button>
                      </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Create New Campaign</DialogTitle>
                      </DialogHeader>
                      
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="campaignName">Campaign Name</Label>
                            <Input
                              id="campaignName"
                              placeholder="Enter campaign name"
                              value={newCampaignName}
                              onChange={(e) => setNewCampaignName(e.target.value)}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Target Type</Label>
                            <Select value={targetType} onValueChange={setTargetType}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="contact_group">Contact Group</SelectItem>
                                <SelectItem value="local_contacts">All Local Contacts</SelectItem>
                                <SelectItem value="whatsapp_group">WhatsApp Group</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {targetType === "contact_group" && (
                            <div className="space-y-2">
                              <Label>Contact Group</Label>
                              <Select value={selectedContactGroup} onValueChange={setSelectedContactGroup}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select contact group" />
                                </SelectTrigger>
                                <SelectContent>
                                  {contactGroups.map((group: ContactGroup) => (
                                    <SelectItem key={group.id} value={group.id}>
                                      {group.name} ({group.validContacts} contacts)
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {targetType === "whatsapp_group" && (
                            <div className="space-y-2">
                              <Label>WhatsApp Group</Label>
                              <Select value={selectedWhatsAppGroup} onValueChange={setSelectedWhatsAppGroup}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select WhatsApp group" />
                                </SelectTrigger>
                                <SelectContent>
                                  {groups.map((group: Group) => (
                                    <SelectItem key={group.id} value={group.id}>
                                      {group.name} ({group.participants?.length || 0} members)
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                            </div>
                          )}
                          
                          <div className="space-y-2">
                            <Label htmlFor="message">Message</Label>
                            <Textarea
                              id="message"
                              placeholder="Type your message here..."
                              rows={4}
                              value={bulkMessage}
                              onChange={(e) => setBulkMessage(e.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Media Attachment (Optional)</Label>
                            <Input
                              type="file"
                              accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                              onChange={handleMediaSelect}
                            />
                            {selectedMedia && (
                              <div className="text-sm text-muted-foreground">
                                Selected: {selectedMedia.name} ({(selectedMedia.size / 1024 / 1024).toFixed(2)} MB)
                              </div>
                            )}
                          </div>

                          {/* Time Post Field */}
                          <div className="space-y-2">
                            <Label>Time post</Label>
                            <Input
                              type="datetime-local"
                              value={timePost}
                              onChange={(e) => setTimePost(e.target.value)}
                              placeholder="Select starting date and time"
                            />
                          </div>

                          {/* Random Message Interval Controls */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Random message interval by minimum (second)</Label>
                              <Input
                                type="number"
                                min="1"
                                max="3600"
                                value={minInterval}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 1;
                                  setMinInterval(Math.max(1, Math.min(3600, value)));
                                  if (value > maxInterval) {
                                    setMaxInterval(value);
                                  }
                                }}
                                placeholder="Enter seconds (1-3600)"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Random message interval by maximum (second)</Label>
                              <Input
                                type="number"
                                min={minInterval}
                                max="3600"
                                value={maxInterval}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 10;
                                  setMaxInterval(Math.max(minInterval, Math.min(3600, value)));
                                }}
                                placeholder="Enter seconds (1-3600)"
                              />
                            </div>
                          </div>

                          {/* Schedule Time */}
                          <div className="space-y-4">
                            <Label>Schedule time</Label>
                            
                            {/* Four scheduling buttons */}
                            <div className="flex gap-2 flex-wrap">
                              <Button
                                type="button"
                                variant={scheduleType === 'daytime' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => {
                                  setScheduleType('daytime');
                                  setScheduleHours([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
                                }}
                              >
                                Daytime
                              </Button>
                              <Button
                                type="button"
                                variant={scheduleType === 'nighttime' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => {
                                  setScheduleType('nighttime');
                                  setScheduleHours([0, 1, 2, 3, 4, 5, 6, 19, 20, 21, 22, 23]);
                                }}
                              >
                                Nighttime
                              </Button>
                              <Button
                                type="button"
                                variant={scheduleType === 'odd_hours' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => {
                                  setScheduleType('odd_hours');
                                  setScheduleHours([1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23]);
                                }}
                              >
                                Odd
                              </Button>
                              <Button
                                type="button"
                                variant={scheduleType === 'even_hours' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => {
                                  setScheduleType('even_hours');
                                  setScheduleHours([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
                                }}
                              >
                                Even
                              </Button>
                            </div>

                            {/* Hour Selection Tags */}
                            {scheduleHours.length > 0 && (
                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-1">
                                  {scheduleHours.map((hour) => (
                                    <Badge key={hour} variant="secondary" className="flex items-center gap-1">
                                      {hour}
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-0 w-4 h-4"
                                        onClick={() => {
                                          setScheduleHours(prev => prev.filter(h => h !== hour));
                                        }}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </Badge>
                                  ))}
                                </div>
                                
                                {/* Add hour dropdown */}
                                <div className="flex items-center gap-2">
                                  <Select
                                    onValueChange={(value) => {
                                      const hour = parseInt(value);
                                      if (!scheduleHours.includes(hour)) {
                                        setScheduleHours(prev => [...prev, hour].sort((a, b) => a - b));
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="w-40">
                                      <SelectValue placeholder="Add hour" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(() => {
                                        const availableHours = [];
                                        for (let i = 0; i < 24; i++) {
                                          if (!scheduleHours.includes(i)) {
                                            availableHours.push(i);
                                          }
                                        }
                                        return availableHours.map((hour) => (
                                          <SelectItem key={hour} value={hour.toString()}>
                                            {hour}:00
                                          </SelectItem>
                                        ));
                                      })()}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}
                            
                            <p className="text-sm text-muted-foreground">
                              The schedule allows you to set up a unique schedule by time for your campaign to run. 
                              Set empty to campaign run anytime.
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-end space-x-2">
                          <Button variant="outline" onClick={() => setShowBulkMessageDialog(false)}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleCreateEnhancedCampaign}
                            disabled={createBulkCampaignMutation.isPending}
                          >
                            {createBulkCampaignMutation.isPending ? "Creating..." : "Create Campaign"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {/* Enhanced Analytics Section - Moved to top */}
                {bulkCampaigns.length > 0 && (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          Campaign Analytics
                          <Badge variant="outline" className="text-xs">
                            Last updated: {new Date().toLocaleTimeString()}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                          <div className="text-center p-4 border rounded-lg">
                            <div className="text-3xl font-bold text-blue-600 mb-1">
                              {bulkCampaigns.length}
                            </div>
                            <p className="text-sm text-muted-foreground">Total Campaigns</p>
                            <div className="text-xs text-muted-foreground mt-1">
                              {bulkCampaigns.filter(c => c.status === 'running').length} active
                            </div>
                          </div>
                          <div className="text-center p-4 border rounded-lg">
                            <div className="text-3xl font-bold text-green-600 mb-1">
                              {bulkCampaigns.reduce((sum, c) => sum + c.sentCount, 0)}
                            </div>
                            <p className="text-sm text-muted-foreground">Messages Sent</p>
                            <div className="text-xs text-green-600 font-medium mt-1">
                              ✓ Success Rate: {
                                Math.round(
                                  (bulkCampaigns.reduce((sum, c) => sum + c.sentCount, 0) / 
                                  Math.max(1, bulkCampaigns.reduce((sum, c) => sum + c.sentCount + c.failedCount, 0))) * 100
                                )
                              }%
                            </div>
                          </div>
                          <div className="text-center p-4 border rounded-lg">
                            <div className="text-3xl font-bold text-red-600 mb-1">
                              {bulkCampaigns.reduce((sum, c) => sum + c.failedCount, 0)}
                            </div>
                            <p className="text-sm text-muted-foreground">Failed Messages</p>
                            <div className="text-xs text-red-600 font-medium mt-1">
                              ✗ Error Rate: {
                                Math.round(
                                  (bulkCampaigns.reduce((sum, c) => sum + c.failedCount, 0) / 
                                  Math.max(1, bulkCampaigns.reduce((sum, c) => sum + c.sentCount + c.failedCount, 0))) * 100
                                )
                              }%
                            </div>
                          </div>
                          <div className="text-center p-4 border rounded-lg">
                            <div className="text-3xl font-bold text-purple-600 mb-1">
                              {bulkCampaigns.filter(c => c.status === 'completed').length}
                            </div>
                            <p className="text-sm text-muted-foreground">Completed</p>
                            <div className="text-xs text-muted-foreground mt-1">
                              {bulkCampaigns.filter(c => c.status === 'draft').length} draft, 
                              {bulkCampaigns.filter(c => c.status === 'paused').length} paused
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Campaign List */}
                <div className="space-y-4">
                  {!sessionInfo ? (
                    <Card>
                      <CardContent className="text-center py-8">
                        <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Connect WhatsApp</h3>
                        <p className="text-muted-foreground">
                          Please connect to WhatsApp first to create campaigns.
                        </p>
                      </CardContent>
                    </Card>
                  ) : campaignsLoading ? (
                    <Card>
                      <CardContent className="text-center py-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                        <p className="mt-4 text-muted-foreground">Loading campaigns...</p>
                      </CardContent>
                    </Card>
                  ) : bulkCampaigns.length === 0 ? (
                    <Card>
                      <CardContent className="text-center py-8">
                        <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
                        <p className="text-muted-foreground mb-4">Create your first bulk messaging campaign</p>
                        <Button onClick={() => setShowBulkMessageDialog(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Campaign
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-4 max-h-[calc(100vh-300px)] overflow-y-auto">
                      {bulkCampaigns.map((campaign: BulkCampaign) => (
                        <Card key={campaign.id}>
                          <CardHeader>
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="flex items-center gap-2">
                                  {campaign.name}
                                  <Badge 
                                    className={
                                      campaign.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                                      campaign.status === 'running' ? 'bg-blue-100 text-blue-800' :
                                      campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                                      campaign.status === 'completed' ? 'bg-green-100 text-green-800' :
                                      campaign.status === 'failed' ? 'bg-red-100 text-red-800' :
                                      'bg-gray-100 text-gray-800'
                                    }
                                  >
                                    {campaign.status}
                                  </Badge>
                                </CardTitle>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Created: {new Date(campaign.createdAt).toLocaleString()}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                {campaign.status === "draft" && (
                                  <Button 
                                    size="sm" 
                                    onClick={() => executeCampaign(campaign.id)}
                                    disabled={sendBulkCampaignMutation.isPending}
                                  >
                                    <Send className="h-4 w-4 mr-1" />
                                    Start
                                  </Button>
                                )}
                                {campaign.status === "running" && (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => pauseCampaign(campaign.id)}
                                  >
                                    <Clock className="h-4 w-4 mr-1" />
                                    Pause
                                  </Button>
                                )}
                                {campaign.status === "paused" && (
                                  <Button 
                                    size="sm"
                                    onClick={() => resumeCampaign(campaign.id)}
                                  >
                                    <Send className="h-4 w-4 mr-1" />
                                    Resume
                                  </Button>
                                )}
                                {(campaign.status === "completed" || campaign.status === "failed") && (
                                  <Button 
                                    size="sm"
                                    variant="outline"
                                    onClick={() => restartCampaign(campaign.id)}
                                    disabled={sendBulkCampaignMutation.isPending}
                                  >
                                    <RotateCcw className="h-4 w-4 mr-1" />
                                    Restart
                                  </Button>
                                )}
                                <Button 
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => deleteCampaign(campaign.id)}
                                  disabled={sendBulkCampaignMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div>
                                <h4 className="font-medium text-sm mb-1">Message Preview</h4>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {campaign.message}
                                </p>
                              </div>

                              {/* Enhanced Progress Section */}
                              {(campaign.sentCount > 0 || campaign.failedCount > 0) && (
                                <div className="space-y-3">
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="font-medium">Progress</span>
                                    <span className="text-muted-foreground">
                                      {campaign.sentCount + campaign.failedCount} / {campaign.totalTargets} 
                                      ({Math.round(((campaign.sentCount + campaign.failedCount) / Math.max(1, campaign.totalTargets)) * 100)}%)
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div 
                                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                                      style={{
                                        width: `${((campaign.sentCount + campaign.failedCount) / Math.max(1, campaign.totalTargets)) * 100}%`
                                      }}
                                    ></div>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-green-600 font-medium">✓ {campaign.sentCount} sent</span>
                                    <span className="text-red-600 font-medium">✗ {campaign.failedCount} failed</span>
                                    <span className="text-blue-600 font-medium">⏳ {campaign.totalTargets - campaign.sentCount - campaign.failedCount} remaining</span>
                                  </div>
                                  {campaign.status === "running" && (
                                    <div className="text-xs text-muted-foreground flex justify-between items-center mt-2 pt-2 border-t">
                                      <span>Status: Active</span>
                                      <span className="flex items-center">
                                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></span>
                                        Sending messages...
                                      </span>
                                    </div>
                                  )}
                                  {campaign.status === "completed" && (
                                    <div className="text-xs text-green-600 font-medium mt-2 pt-2 border-t">
                                      ✅ Campaign completed successfully
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="font-medium">Sent:</span>
                                  <p className="text-green-600 font-medium">
                                    {campaign.sentCount}
                                    {campaign.status === "running" && <span className="animate-pulse ml-1">●</span>}
                                  </p>
                                </div>
                                <div>
                                  <span className="font-medium">Failed:</span>
                                  <p className="text-red-600 font-medium">{campaign.failedCount}</p>
                                </div>
                                <div>
                                  <span className="font-medium">Target Type:</span>
                                  <p className="text-muted-foreground capitalize">Contact Group</p>
                                </div>
                                <div>
                                  <span className="font-medium">Status:</span>
                                  <p className="text-muted-foreground capitalize">{campaign.status}</p>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}


                </div>
              </div>
            )}



            {/* Chats Module */}
            {selectedModule === 'chats' && (
              <div className="flex flex-col h-full">
                {/* Sticky Header */}
                <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 p-6 pb-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="h-5 w-5" />
                      <span className="text-lg font-semibold">WhatsApp Chats</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    View and manage your WhatsApp conversations
                  </p>
                </div>
                
                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 pr-2 min-h-0">
                  {!sessionInfo ? (
                    <div className="text-center p-8">
                      <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Connect WhatsApp</h3>
                      <p className="text-muted-foreground">
                        Please connect to WhatsApp first to view your chats.
                      </p>
                    </div>
                  ) : chatsLoading ? (
                    <div className="text-center p-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                      <p className="mt-4 text-muted-foreground">Loading chats...</p>
                    </div>
                  ) : chats.length === 0 ? (
                    <div className="text-center p-8">
                      <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Chats Found</h3>
                      <p className="text-muted-foreground">
                        Your WhatsApp chats will appear here once you start conversations.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {chats.map((chat: Chat) => (
                        <div key={chat.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                {chat.isGroup ? <Users className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
                              </div>
                              <div>
                                <h4 className="font-semibold">{chat.name}</h4>
                                {chat.lastMessage && (
                                  <p className="text-sm text-muted-foreground truncate max-w-xs">
                                    {chat.lastMessage.fromMe ? 'You: ' : ''}{chat.lastMessage.body}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              {chat.unreadCount > 0 && (
                                <Badge variant="default" className="mb-1">
                                  {chat.unreadCount}
                                </Badge>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {new Date(chat.timestamp * 1000).toLocaleDateString('en-GB')} {new Date(chat.timestamp * 1000).toLocaleTimeString()}
                              </p>
                              <div className="flex items-center space-x-2 mt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setLocation(`/chat/${chat.id}`)}
                                >
                                  Open Chat
                                </Button>

                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Groups Module */}
            {selectedModule === 'groups' && (
              <div className="flex flex-col h-full">
                {/* Sticky Header */}
                <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 p-6 pb-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Users className="h-5 w-5" />
                      <span className="text-lg font-semibold">WhatsApp Groups</span>
                    </div>
                    <Button 
                      onClick={exportAllGroupsCSV}
                      disabled={!sessionInfo || groups.length === 0}
                      size="sm"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Extract all to CSVs
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    View and manage your WhatsApp group conversations
                  </p>
                </div>
                
                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 pr-2 min-h-0">
                  {!sessionInfo ? (
                    <div className="text-center p-8">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Connect WhatsApp</h3>
                      <p className="text-muted-foreground">
                        Please connect to WhatsApp first to view your groups.
                      </p>
                    </div>
                  ) : groupsLoading ? (
                    <div className="text-center p-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                      <p className="mt-4 text-muted-foreground">Loading groups...</p>
                    </div>
                  ) : groups.length === 0 ? (
                    <div className="text-center p-8">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Groups Found</h3>
                      <p className="text-muted-foreground">
                        Your WhatsApp groups will appear here once you join some groups.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {groups.map((group: Group) => (
                        <div key={group.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-full bg-green-200 dark:bg-green-700 flex items-center justify-center">
                                <Users className="h-5 w-5" />
                              </div>
                              <div>
                                <h4 className="font-semibold">{group.name}</h4>
                                {group.lastMessage && (
                                  <p className="text-sm text-muted-foreground truncate max-w-xs">
                                    {group.lastMessage.fromMe ? 'You: ' : ''}{group.lastMessage.body}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  {group.participants.length} participants
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              {group.unreadCount > 0 && (
                                <Badge variant="default" className="mb-1">
                                  {group.unreadCount}
                                </Badge>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {new Date(group.timestamp * 1000).toLocaleDateString('en-GB')} {new Date(group.timestamp * 1000).toLocaleTimeString()}
                              </p>
                              <div className="flex items-center space-x-2 mt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(`/api/groups/${group.id}/export`)}
                                >
                                  <Download className="h-4 w-4 mr-1" />
                                  Export
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setLocation(`/chat/${group.id}`)}
                                >
                                  Open Chat
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Reports Module */}
            {selectedModule === 'reports' && (
              <div className="p-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Reports</CardTitle>
                    <CardDescription>Analytics and reporting features</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center p-8">
                      <BarChart3 className="h-12 w-12 text-orange-500 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
                      <p className="text-muted-foreground">
                        Comprehensive WhatsApp analytics, message reports, and performance insights will be available here soon.
                      </p>
                    </div>
                  </CardContent>
                </Card>
                </div>
              )}

            {/* Placeholder for other modules */}
            {!['send-message', 'button-template', 'poll-template', 'list-template', 'contacts', 'reports', 'chats', 'contact-groups', 'bulk-messaging', 'groups'].includes(selectedModule) && (
              <div className="p-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Feature Coming Soon</CardTitle>
                    <CardDescription>This feature is under development</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center p-8">
                      <div className="h-12 w-12 bg-gray-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
                        <span className="text-gray-400">🚧</span>
                      </div>
                      <h3 className="text-lg font-semibold mb-2">Under Development</h3>
                      <p className="text-muted-foreground">
                        This feature is currently being developed and will be available soon.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        ) : selectedFeature === 'rcs' ? (
          <div className="p-6">
            <Card>
                <CardHeader>
                  <CardTitle>RCS Messaging</CardTitle>
                  <CardDescription>Rich Communication Services (Coming Soon)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center p-8">
                    <Smartphone className="h-12 w-12 text-purple-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">RCS Features</h3>
                    <p className="text-muted-foreground">
                      RCS messaging features will be available in a future update, offering rich messaging capabilities.
                    </p>
                  </div>
                </CardContent>
            </Card>
          </div>
        ) : null}
        </div>
      </div>

      {/* Create Contact Group Dialog */}
      <Dialog open={showCreateGroupDialog} onOpenChange={setShowCreateGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Contact Group</DialogTitle>
            <DialogDescription>
              Create a new contact group to organize contacts for bulk messaging campaigns.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Group Name</Label>
              <div className="relative">
                <Input
                  id="group-name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !createContactGroupMutation.isPending && newGroupName.trim()) {
                      handleCreateGroup();
                    }
                  }}
                />
                <Label 
                  htmlFor="group-name" 
                  className={`absolute left-3 pointer-events-none transition-all duration-200 ${
                    fieldValues.newGroupName
                      ? "hidden"
                      : "top-3 text-sm text-gray-500 dark:text-gray-400"
                  }`}
                >
                  Enter group name
                </Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-description">Description (Optional)</Label>
              <div className="relative">
                <Textarea
                  id="group-description"
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !createContactGroupMutation.isPending && newGroupName.trim()) {
                      e.preventDefault(); // Prevent new line
                      handleCreateGroup();
                    }
                  }}
                />
                <Label 
                  htmlFor="group-description" 
                  className={`absolute left-3 top-3 pointer-events-none transition-all duration-200 ${
                    fieldValues.newGroupDescription
                      ? "hidden"
                      : "text-sm text-gray-500 dark:text-gray-400"
                  }`}
                >
                  Enter group description
                </Label>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateGroupDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateGroup}
                disabled={createContactGroupMutation.isPending || !newGroupName.trim()}
              >
                {createContactGroupMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Group
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>



      {/* Add to Contact Groups Dialog */}
      <Dialog open={showAddToGroupsDialog} onOpenChange={setShowAddToGroupsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Contact Groups</DialogTitle>
            <DialogDescription>
              Select contact groups to add the selected {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''} to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {contactGroups.length === 0 ? (
                <div className="text-center p-4">
                  <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No contact groups available. Create a contact group first.
                  </p>
                </div>
              ) : (
                contactGroups.map((group: ContactGroup) => (
                  <div key={group.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`group-${group.id}`}
                      checked={selectedGroupsForAdd.has(group.id)}
                      onCheckedChange={(checked) => {
                        setSelectedGroupsForAdd(prev => {
                          const newSet = new Set(prev);
                          if (checked) {
                            newSet.add(group.id);
                          } else {
                            newSet.delete(group.id);
                          }
                          return newSet;
                        });
                      }}
                      data-testid={`checkbox-group-${group.id}`}
                    />
                    <label 
                      htmlFor={`group-${group.id}`} 
                      className="text-sm font-medium cursor-pointer flex-1"
                    >
                      {group.name}
                      <span className="text-muted-foreground"> ({group.validContacts} contacts)</span>
                    </label>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddToGroupsDialog(false);
                  setSelectedGroupsForAdd(new Set());
                }}
                data-testid="button-cancel-add-to-groups"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddContactsToGroups}
                disabled={addToGroupsMutation.isPending || selectedGroupsForAdd.size === 0}
                data-testid="button-add-to-groups"
              >
                {addToGroupsMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Adding...
                  </>
                ) : (
                  <>
                    <Users className="mr-2 h-4 w-4" />
                    Add
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}