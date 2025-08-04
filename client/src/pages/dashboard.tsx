import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { websocketManager, type WebSocketMessage } from "@/lib/websocket";
import { Send, MessageSquare, Users, Plus, Smartphone, Paperclip, X, Upload, FileText, Image, Video, Music, File, Download, Search, Clock, Phone, Trash2, BarChart3 } from "lucide-react";
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
  
  // Form states
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Contact Groups state
  const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false);
  const [showBulkMessageDialog, setShowBulkMessageDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [selectedContactGroup, setSelectedContactGroup] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  
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

  // Fetch bulk campaigns
  const { data: bulkCampaigns = [], isLoading: campaignsLoading } = useQuery<BulkCampaign[]>({
    queryKey: ['/api/bulk-campaigns'],
    refetchInterval: 30000,
  });

  // WebSocket connection for real-time updates using centralized manager
  useEffect(() => {
    const handleWebSocketMessage = (message: WebSocketMessage) => {
      switch (message.type) {
        case 'qr':
          // Invalidate QR-related queries to fetch new QR
          queryClient.invalidateQueries({ queryKey: ['/api/get-qr'] });
          break;
        case 'connected':
          // Invalidate session info when connected and refresh data
          queryClient.invalidateQueries({ queryKey: ['/api/session-info'] });
          queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
          queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
          queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
          break;
        case 'disconnected':
        case 'logout':
          // Invalidate all session-related queries
          queryClient.invalidateQueries({ queryKey: ['/api/session-info'] });
          queryClient.invalidateQueries({ queryKey: ['/api/get-qr'] });
          break;
        case 'chats_updated':
          // Update chats cache with real-time data
          if (message.data?.chats) {
            queryClient.setQueryData(['/api/chats'], message.data.chats);
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

  // Handle CSV file upload
  const handleCSVUpload = async (groupId: string, file: File) => {
    const formData = new FormData();
    formData.append('csv', file);
    
    try {
      const response = await fetch(`/api/contact-groups/${groupId}/import-csv`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Failed to upload CSV');
      
      const result = await response.json();
      toast({
        title: "CSV Imported Successfully",
        description: `Imported ${result.validContacts} valid contacts, ${result.invalidContacts} invalid, ${result.duplicateContacts} duplicates`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/contact-groups'] });
    } catch (error: any) {
      toast({
        title: "Failed to Import CSV",
        description: error.message || "Failed to import CSV file",
        variant: "destructive",
      });
    }
  };

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
            className="flex items-center p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
            onClick={() => setLocation('/account')}
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
              <Badge variant={sessionInfo ? "default" : "secondary"} className="text-sm px-3 py-1 cursor-pointer">
                <div className={`w-2 h-2 rounded-full mr-2 ${sessionInfo ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
                <span className="whitespace-nowrap">{sessionInfo ? "Connected" : "Not Connected"}</span>
              </Badge>
            </div>
          </div>
        </div>
        


        {/* Features List */}
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
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
          {selectedFeature === 'whatsapp' ? (
            <div className="p-6">
              {/* Send Message Module */}
              {selectedModule === 'send-message' && (
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
                        <div className="flex-1 relative">
                          <Input
                            id="phone-number"
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                            className="w-full"
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
              )}

              {/* Template Modules */}
              {selectedModule === 'button-template' && (
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
              )}

              {selectedModule === 'poll-template' && (
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
              )}

              {selectedModule === 'list-template' && (
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
              )}

              {selectedModule === 'contacts' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Phone className="h-5 w-5" />
                        <span>WhatsApp Contacts</span>
                      </div>
                      <Button 
                        onClick={exportContactsCSV}
                        disabled={!sessionInfo || contacts.length === 0}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      Your WhatsApp contacts from connected device
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
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
                        {contacts.map((contact: Contact) => (
                          <div key={contact.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-full bg-blue-200 dark:bg-blue-700 flex items-center justify-center">
                                  <Phone className="h-5 w-5" />
                                </div>
                                <div>
                                  <h4 className="font-semibold">{contact.name}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {contact.number}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setLocation(`/chat/${contact.id}`)}
                                >
                                  <MessageSquare className="h-4 w-4 mr-1" />
                                  Chat
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}



              {/* Contact Groups Module */}
              {selectedModule === 'contact-groups' && (
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
                                  title="View Contacts"
                                  className="h-8 w-8 p-0 flex items-center justify-center"
                                >
                                  <Users className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => document.getElementById(`csv-upload-${group.id}`)?.click()}
                                  title="Import CSV"
                                  className="h-8 w-8 p-0 flex items-center justify-center"
                                >
                                  <Upload className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(`/api/contact-groups/${group.id}/export`)}
                                  title="Export"
                                  className="h-8 w-8 p-0 flex items-center justify-center"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => deleteContactGroupMutation.mutate(group.id)}
                                  disabled={deleteContactGroupMutation.isPending}
                                  title="Delete"
                                  className="h-8 w-8 p-0 flex items-center justify-center"
                                >
                                  <Trash2 className="h-4 w-4" />
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
              )}

              {/* Bulk Messaging Module */}
              {selectedModule === 'bulk-messaging' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Send className="h-5 w-5" />
                        <span>Bulk Messaging</span>
                      </div>
                      <Button 
                        onClick={() => setShowBulkMessageDialog(true)}
                        disabled={!sessionInfo || contactGroups.length === 0}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Send Bulk Message
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      Send messages to multiple contacts at once using contact groups
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {contactGroups.length === 0 ? (
                      <div className="text-center p-8">
                        <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No Contact Groups</h3>
                        <p className="text-muted-foreground mb-4">
                          Create contact groups first to start bulk messaging campaigns.
                        </p>
                        <Button onClick={() => setSelectedModule('contact-groups')}>
                          Go to Contact Groups
                        </Button>
                      </div>
                    ) : campaignsLoading ? (
                      <div className="text-center p-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                        <p className="mt-4 text-muted-foreground">Loading campaigns...</p>
                      </div>
                    ) : bulkCampaigns.length === 0 ? (
                      <div className="text-center p-8">
                        <Send className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No Bulk Messages Sent</h3>
                        <p className="text-muted-foreground mb-4">
                          Send a bulk message to reach multiple contacts.
                        </p>
                        <Button onClick={() => setShowBulkMessageDialog(true)}>
                          <Send className="h-4 w-4 mr-2" />
                          Send Bulk Message
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {bulkCampaigns.map((campaign: BulkCampaign) => (
                          <div key={campaign.id} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-semibold">{campaign.name}</h4>
                                <p className="text-sm text-muted-foreground truncate">{campaign.message}</p>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Badge variant={campaign.status === 'sent' ? 'default' : 'secondary'}>
                                  {campaign.status}
                                </Badge>
                                {campaign.status === 'draft' && (
                                  <Button
                                    size="sm"
                                    onClick={() => sendBulkCampaignMutation.mutate(campaign.id)}
                                    disabled={sendBulkCampaignMutation.isPending}
                                  >
                                    Send Now
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                              <span>Sent: {campaign.sentCount}</span>
                              <span>Failed: {campaign.failedCount}</span>
                              <span>Created: {new Date(campaign.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Chats Module */}
              {selectedModule === 'chats' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <MessageSquare className="h-5 w-5" />
                      <span>WhatsApp Chats</span>
                    </CardTitle>
                    <CardDescription>
                      View and manage your WhatsApp conversations
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
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
                                  {new Date(chat.timestamp).toLocaleString()}
                                </p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mt-2"
                                  onClick={() => setLocation(`/chat/${chat.id}`)}
                                >
                                  Open Chat
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Groups Module */}
              {selectedModule === 'groups' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Users className="h-5 w-5" />
                        <span>WhatsApp Groups</span>
                      </div>
                      <Button 
                        onClick={exportAllGroupsCSV}
                        disabled={!sessionInfo || groups.length === 0}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Extract all to CSVs
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      View and manage your WhatsApp group conversations
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
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
                                  {new Date(group.timestamp).toLocaleString()}
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
                  </CardContent>
                </Card>
              )}

              {/* Reports Module */}
              {selectedModule === 'reports' && (
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
              )}

              {/* Placeholder for other modules */}
              {!['send-message', 'button-template', 'poll-template', 'list-template', 'contacts', 'reports', 'chats', 'contact-groups', 'bulk-messaging', 'groups'].includes(selectedModule) && (
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
              )}
            </div>
          ) : selectedFeature === 'rcs' ? (
            /* RCS Content */
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

      {/* Send Bulk Message Dialog */}
      <Dialog open={showBulkMessageDialog} onOpenChange={setShowBulkMessageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Bulk Message</DialogTitle>
            <DialogDescription>
              Send a message to every contact in the selected group.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact-group">Select Contact Group</Label>
              <Select value={selectedContactGroup} onValueChange={setSelectedContactGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a contact group" />
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
            <div className="space-y-2">
              <Label htmlFor="bulk-message">Message</Label>
              <div className="relative">
                <Textarea
                  id="bulk-message"
                  value={bulkMessage}
                  onChange={(e) => setBulkMessage(e.target.value)}
                  rows={4}
                />
                <Label 
                  htmlFor="bulk-message" 
                  className={`absolute left-3 top-3 pointer-events-none transition-all duration-200 ${
                    fieldValues.bulkMessage
                      ? "hidden"
                      : "text-sm text-gray-500 dark:text-gray-400"
                  }`}
                >
                  Enter your message...
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                {bulkMessage.length}/1000 characters
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowBulkMessageDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendBulkMessage}
                disabled={sendContactGroupMutation.isPending || !selectedContactGroup || !bulkMessage.trim()}
              >
                {sendContactGroupMutation.isPending ? (
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
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}