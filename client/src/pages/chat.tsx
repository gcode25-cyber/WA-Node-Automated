import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Send, 
  ArrowLeft, 
  Paperclip, 
  X, 
  Upload, 
  FileText, 
  Image, 
  Video, 
  Music, 
  File,
  Phone,
  Users
} from "lucide-react";

interface Contact {
  id: string;
  name: string;
  number: string;
  isMyContact: boolean;
  isWAContact: boolean;
  profilePicUrl: string | null;
  isGroup: boolean;
}

interface Message {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  type: string;
  hasMedia: boolean;
  mediaUrl?: string;
}

interface ChatHistory {
  contact: Contact;
  messages: Message[];
}

export default function ChatPage() {
  const [match, params] = useRoute("/chat/:contactId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const contactId = params?.contactId;

  // Fetch contact details from multiple sources
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
  });
  
  const { data: groups = [] } = useQuery<Contact[]>({
    queryKey: ['/api/groups'],
  });

  const contact = contacts.find(c => c.id === contactId) || groups.find(g => g.id === contactId);

  // Fetch chat history from WhatsApp Web API
  const { data: chatHistory, isLoading: chatLoading } = useQuery<ChatHistory>({
    queryKey: ['/api/chat-history', contactId],
    enabled: !!contactId,
    refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
    staleTime: 3000,
  });

  // Send text message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { phoneNumber: string; message: string }) => {
      return fetch('/api/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: 'primary',
          phoneNumber: data.phoneNumber,
          message: data.message
        })
      }).then(async res => {
        const responseData = await res.json();
        if (!res.ok) {
          throw new Error(responseData.error || 'Failed to send message');
        }
        return responseData;
      });
    },
    onSuccess: () => {
      setMessage("");
      toast({
        title: "Message Sent",
        description: "Your message has been sent successfully",
      });
      // Refresh chat history
      queryClient.invalidateQueries({ queryKey: ['/api/chat-history', contactId] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Message",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  });

  // Send media message mutation
  const sendMediaMutation = useMutation({
    mutationFn: async (data: { phoneNumber: string; message: string; file: File }) => {
      const formData = new FormData();
      formData.append('accountId', 'primary');
      formData.append('phoneNumber', data.phoneNumber);
      formData.append('message', data.message);
      formData.append('media', data.file);

      return fetch('/api/send-media-message', {
        method: 'POST',
        body: formData
      }).then(async res => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to send media message');
        }
        return data;
      });
    },
    onSuccess: () => {
      setMessage("");
      setSelectedFile(null);
      toast({
        title: "Media Sent",
        description: "Your media has been sent successfully",
      });
      // Refresh chat history
      queryClient.invalidateQueries({ queryKey: ['/api/chat-history', contactId] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Media",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory?.messages]);

  if (!match || !contactId) {
    setLocation("/dashboard");
    return null;
  }

  if (!contact) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-6 text-center">
              <h3 className="text-lg font-semibold mb-2">Contact Not Found</h3>
              <p className="text-muted-foreground mb-4">
                The requested contact could not be found.
              </p>
              <Button onClick={() => setLocation("/dashboard")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const handleSendMessage = () => {
    if (!message.trim() && !selectedFile) return;

    // For groups, use the full group ID; for individuals, use their phone number
    const phoneNumber = contact.isGroup ? contact.id : (contact.number || contact.id.split('@')[0]);

    if (selectedFile) {
      sendMediaMutation.mutate({
        phoneNumber,
        message: message.trim(),
        file: selectedFile
      });
    } else {
      sendMessageMutation.mutate({
        phoneNumber,
        message: message.trim()
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const getFileIcon = (file: File) => {
    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();

    if (fileType.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (fileType.startsWith('video/')) return <Video className="h-4 w-4" />;
    if (fileType.startsWith('audio/')) return <Music className="h-4 w-4" />;
    if (fileType.includes('pdf') || fileName.endsWith('.pdf')) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="max-w-4xl mx-auto h-screen flex flex-col">
        {/* Chat Header */}
        <Card className="rounded-none border-x-0 border-t-0">
          <CardHeader className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    if (contact?.isGroup) {
                      setLocation("/dashboard?module=groups");
                    } else {
                      setLocation("/dashboard?module=chats");
                    }
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  contact.isGroup ? 'bg-green-100' : 'bg-blue-100'
                }`}>
                  {contact.isGroup ? (
                    <Users className="h-5 w-5 text-green-600" />
                  ) : (
                    <Phone className="h-5 w-5 text-blue-600" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-lg">{contact.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {/* Hide group ID for admin-only groups */}
                    {contact.isGroup && (contact as any).onlyAdminsCanMessage && !(contact as any).isAdmin 
                      ? `${(contact as any).participants?.length || 0} participants`
                      : (contact.number || contact.id)
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {contact.isMyContact && (
                  <Badge variant="default" className="text-xs">
                    My Contact
                  </Badge>
                )}
                {contact.isWAContact && (
                  <Badge variant="secondary" className="text-xs">
                    WhatsApp
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Loading chat history...</p>
            </div>
          ) : chatHistory?.messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            chatHistory?.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    msg.fromMe
                      ? 'bg-green-500 text-white'
                      : 'bg-white border shadow-sm'
                  }`}
                >
                  {/* Show sender name for group messages that are not from me */}
                  {contact?.isGroup && !msg.fromMe && (msg as any).author && (
                    <p className="text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">
                      {(msg as any).author}
                    </p>
                  )}
                  
                  {/* Handle media messages */}
                  {msg.hasMedia && msg.mediaUrl ? (
                    <div className="space-y-2">
                      {msg.type === 'image' ? (
                        <img src={msg.mediaUrl} alt="Media" className="max-w-full rounded" />
                      ) : msg.type === 'video' ? (
                        <video src={msg.mediaUrl} controls className="max-w-full rounded" />
                      ) : msg.type === 'audio' ? (
                        <audio src={msg.mediaUrl} controls className="max-w-full" />
                      ) : (
                        <div className="flex items-center space-x-2 p-2 bg-gray-100 dark:bg-gray-700 rounded">
                          <File className="h-4 w-4" />
                          <span className="text-sm">Media File</span>
                        </div>
                      )}
                      {msg.body && <p className="text-sm">{msg.body}</p>}
                    </div>
                  ) : msg.body === '[Media]' ? (
                    <div className="flex items-center space-x-2 p-2 bg-gray-100 dark:bg-gray-700 rounded">
                      <File className="h-4 w-4" />
                      <span className="text-sm">Media File</span>
                    </div>
                  ) : (
                    <p className="text-sm">{msg.body}</p>
                  )}
                  
                  <p className={`text-xs mt-1 ${
                    msg.fromMe ? 'text-green-100' : 'text-muted-foreground'
                  }`}>
                    {new Date(msg.timestamp * 1000).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* File Upload Area */}
        {selectedFile && (
          <Card className="m-4 mb-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getFileIcon(selectedFile)}
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Message Input */}
        <Card className="rounded-none border-x-0 border-b-0">
          <CardContent className="p-4">
            <div 
              className={`flex items-end space-x-2 p-2 border-2 border-dashed rounded-lg transition-colors ${
                isDragOver ? 'border-primary bg-primary/5' : 'border-muted'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              
              <div className="flex-1">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={contact.isGroup && (contact as any).onlyAdminsCanMessage && !(contact as any).isAdmin ? "Only admins can send messages" : "Type a message..."}
                  className="border-0 focus-visible:ring-0 resize-none"
                  disabled={contact.isGroup && (contact as any).onlyAdminsCanMessage && !(contact as any).isAdmin}
                />
              </div>
              
              <Button
                onClick={handleSendMessage}
                disabled={(!message.trim() && !selectedFile) || sendMessageMutation.isPending || sendMediaMutation.isPending || (contact.isGroup && (contact as any).onlyAdminsCanMessage && !(contact as any).isAdmin)}
                size="sm"
              >
                {(sendMessageMutation.isPending || sendMediaMutation.isPending) ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
            />
            
            {isDragOver && (
              <div className="text-center text-sm text-muted-foreground mt-2">
                Drop your file here to attach
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}