import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Play, Pause, RotateCcw, Eye, Upload, Send, Calendar, Clock, Target, Settings, Copy, MoreVertical, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { BulkMessageCampaign, ContactGroup } from "@shared/schema";

interface WhatsAppGroup {
  id: string;
  name: string;
  isGroup: boolean;
  participants?: any[];
}

export default function BulkCampaigns() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("campaigns");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [campaignForm, setCampaignForm] = useState({
    name: "",
    message: "",
    targetType: "",
    contactGroupId: "",
    whatsappGroupId: "",
    scheduleType: "immediate",
    timePost: "",
    scheduleHours: "",
    minInterval: 1,
    maxInterval: 10
  });

  // Fetch campaigns with auto-refresh
  const { data: campaigns = [], isLoading: campaignsLoading, refetch: refetchCampaigns } = useQuery<BulkMessageCampaign[]>({
    queryKey: ["/api/bulk-campaigns"],
    enabled: true,
    refetchInterval: autoRefresh ? 3000 : false, // Auto-refresh every 3 seconds when enabled
    refetchIntervalInBackground: true
  });

  // Auto-refresh effect for running campaigns
  useEffect(() => {
    const hasRunningCampaigns = campaigns.some(c => c.status === "running");
    setAutoRefresh(hasRunningCampaigns);
  }, [campaigns]);

  // WebSocket integration for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    let ws: WebSocket | null = null;
    
    const connectWebSocket = () => {
      try {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log('📡 Campaign WebSocket connected');
        };
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'campaign_progress_update') {
              // Invalidate and refetch campaigns on progress updates
              queryClient.invalidateQueries({ queryKey: ["/api/bulk-campaigns"] });
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        ws.onerror = (error) => {
          console.error('Campaign WebSocket error:', error);
        };
        
        ws.onclose = () => {
          console.log('📡 Campaign WebSocket disconnected');
          // Reconnect after 3 seconds
          setTimeout(connectWebSocket, 3000);
        };
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
      }
    };
    
    connectWebSocket();
    
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // Fetch contact groups
  const { data: contactGroups = [] } = useQuery<ContactGroup[]>({
    queryKey: ["/api/contact-groups"],
    enabled: true
  });

  // Fetch WhatsApp groups
  const { data: whatsappGroups = [] } = useQuery<WhatsAppGroup[]>({
    queryKey: ["/api/groups"],
    enabled: true
  });

  // Fetch campaign targets count
  const { data: targetCount = 0 } = useQuery<number>({
    queryKey: ["/api/campaigns/targets", campaignForm.targetType, campaignForm.contactGroupId, campaignForm.whatsappGroupId],
    enabled: !!campaignForm.targetType
  });

  // Create campaign mutation
  const createCampaignMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/campaigns/create", {
        method: "POST",
        body: formData
      });
      if (!response.ok) throw new Error('Failed to create campaign');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Campaign created successfully" });
      setIsCreateDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/bulk-campaigns"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create campaign", variant: "destructive" });
    }
  });

  // Clone campaign mutation
  const cloneCampaignMutation = useMutation({
    mutationFn: async (campaign: BulkMessageCampaign) => {
      const formData = new FormData();
      formData.append("name", `${campaign.name} (Copy)`);
      formData.append("message", campaign.message);
      formData.append("targetType", campaign.targetType);
      formData.append("scheduleType", campaign.scheduleType);
      formData.append("minInterval", campaign.minInterval.toString());
      formData.append("maxInterval", campaign.maxInterval.toString());
      if (campaign.contactGroupId) formData.append("contactGroupId", campaign.contactGroupId);
      if (campaign.whatsappGroupId) formData.append("whatsappGroupId", campaign.whatsappGroupId);
      if (campaign.timePost) formData.append("timePost", campaign.timePost.toString());
      if (campaign.scheduleHours) formData.append("scheduleHours", campaign.scheduleHours);
      
      const response = await fetch("/api/campaigns/create", {
        method: "POST",
        body: formData
      });
      if (!response.ok) throw new Error('Failed to clone campaign');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Campaign cloned successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/bulk-campaigns"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to clone campaign", variant: "destructive" });
    }
  });

  // Execute campaign mutation
  const executeCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      return apiRequest(`/api/campaigns/${campaignId}/execute`, {
        method: "POST"
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Campaign started successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/bulk-campaigns"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to start campaign", variant: "destructive" });
    }
  });

  // Pause campaign mutation
  const pauseCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      return apiRequest(`/api/campaigns/${campaignId}/pause`, {
        method: "POST"
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Campaign paused successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/bulk-campaigns"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to pause campaign", variant: "destructive" });
    }
  });

  // Resume campaign mutation
  const resumeCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      return apiRequest(`/api/campaigns/${campaignId}/resume`, {
        method: "POST"
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Campaign resumed successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/bulk-campaigns"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to resume campaign", variant: "destructive" });
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const resetForm = () => {
    setCampaignForm({
      name: "",
      message: "",
      targetType: "",
      contactGroupId: "",
      whatsappGroupId: "",
      scheduleType: "immediate",
      timePost: "",
      scheduleHours: "",
      minInterval: 1,
      maxInterval: 10
    });
    setSelectedFile(null);
  };

  const handleCreateCampaign = () => {
    if (!campaignForm.name || !campaignForm.message) {
      toast({ title: "Error", description: "Campaign name and message are required", variant: "destructive" });
      return;
    }

    if (campaignForm.targetType === "contact_group" && !campaignForm.contactGroupId) {
      toast({ title: "Error", description: "Please select a contact group", variant: "destructive" });
      return;
    }

    if (campaignForm.targetType === "whatsapp_group" && !campaignForm.whatsappGroupId) {
      toast({ title: "Error", description: "Please select a WhatsApp group", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    Object.entries(campaignForm).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, value.toString());
      }
    });

    if (selectedFile) {
      formData.append("media", selectedFile);
    }

    createCampaignMutation.mutate(formData);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-100 text-gray-800";
      case "running": return "bg-blue-100 text-blue-800";
      case "paused": return "bg-yellow-100 text-yellow-800";
      case "completed": return "bg-green-100 text-green-800";
      case "failed": return "bg-red-100 text-red-800";
      case "scheduled": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bulk Campaigns</h1>
          <p className="text-muted-foreground">Create and manage bulk messaging campaigns</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetchCampaigns()}
            disabled={campaignsLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${campaignsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Campaign</DialogTitle>
              </DialogHeader>
              
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  <TabsTrigger value="targets">Targets</TabsTrigger>
                  <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
                  <TabsTrigger value="media">Media</TabsTrigger>
                </TabsList>
                
                <TabsContent value="basic" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="campaignName">Campaign Name</Label>
                    <Input
                      id="campaignName"
                      placeholder="Enter campaign name"
                      value={campaignForm.name}
                      onChange={(e) => setCampaignForm(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      placeholder="Type your message here..."
                      rows={6}
                      value={campaignForm.message}
                      onChange={(e) => setCampaignForm(prev => ({ ...prev, message: e.target.value }))}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="targets" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Target Type</Label>
                    <Select
                      value={campaignForm.targetType}
                      onValueChange={(value) => setCampaignForm(prev => ({ ...prev, targetType: value, contactGroupId: "", whatsappGroupId: "" }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select target type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contact_group">Contact Group</SelectItem>
                        <SelectItem value="whatsapp_group">WhatsApp Group</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {campaignForm.targetType === "contact_group" && (
                    <div className="space-y-2">
                      <Label>Contact Group</Label>
                      <Select
                        value={campaignForm.contactGroupId}
                        onValueChange={(value) => setCampaignForm(prev => ({ ...prev, contactGroupId: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select contact group" />
                        </SelectTrigger>
                        <SelectContent>
                          {contactGroups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name} ({group.totalContacts} contacts)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {campaignForm.targetType === "whatsapp_group" && (
                    <div className="space-y-2">
                      <Label>WhatsApp Group</Label>
                      <Select
                        value={campaignForm.whatsappGroupId}
                        onValueChange={(value) => setCampaignForm(prev => ({ ...prev, whatsappGroupId: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select WhatsApp group" />
                        </SelectTrigger>
                        <SelectContent>
                          {whatsappGroups.filter(group => group.isGroup).map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {targetCount > 0 && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <Target className="inline w-4 h-4 mr-2" />
                        This campaign will target {targetCount} recipients
                      </p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="scheduling" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Schedule Type</Label>
                    <Select
                      value={campaignForm.scheduleType}
                      onValueChange={(value) => setCampaignForm(prev => ({ ...prev, scheduleType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select schedule type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">Send Immediately</SelectItem>
                        <SelectItem value="scheduled">Schedule for Later</SelectItem>
                        <SelectItem value="odd_hours">Send in Odd Hours (9, 11, 13, 15)</SelectItem>
                        <SelectItem value="even_hours">Send in Even Hours (10, 12, 14, 16)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {campaignForm.scheduleType === "scheduled" && (
                    <div className="space-y-2">
                      <Label>Schedule Time</Label>
                      <Input
                        type="datetime-local"
                        value={campaignForm.timePost}
                        onChange={(e) => setCampaignForm(prev => ({ ...prev, timePost: e.target.value }))}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Min Interval (seconds)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="300"
                        value={campaignForm.minInterval}
                        onChange={(e) => setCampaignForm(prev => ({ ...prev, minInterval: parseInt(e.target.value) || 1 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Interval (seconds)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="300"
                        value={campaignForm.maxInterval}
                        onChange={(e) => setCampaignForm(prev => ({ ...prev, maxInterval: parseInt(e.target.value) || 10 }))}
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="media" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Media Attachment (Optional)</Label>
                    <Input
                      type="file"
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                      onChange={handleFileSelect}
                    />
                    {selectedFile && (
                      <div className="text-sm text-muted-foreground">
                        Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateCampaign}
                  disabled={createCampaignMutation.isPending}
                >
                  {createCampaignMutation.isPending ? "Creating..." : "Create Campaign"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <div className="space-y-4">
            {campaignsLoading ? (
              <div className="text-center py-8">Loading campaigns...</div>
            ) : campaigns.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
                  <p className="text-muted-foreground mb-4">Create your first bulk messaging campaign</p>
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Campaign
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {campaigns.map((campaign) => (
                  <Card key={campaign.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {campaign.name}
                            <Badge className={getStatusColor(campaign.status)}>
                              {campaign.status}
                            </Badge>
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            Created: {formatDate(campaign.createdAt.toString())}
                            {campaign.lastExecuted && (
                              <span className="ml-4">
                                Last executed: {formatDate(campaign.lastExecuted.toString())}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {campaign.status === "draft" && (
                            <Button 
                              size="sm" 
                              onClick={() => executeCampaignMutation.mutate(campaign.id)}
                              disabled={executeCampaignMutation.isPending}
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Start
                            </Button>
                          )}
                          {campaign.status === "running" && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => pauseCampaignMutation.mutate(campaign.id)}
                              disabled={pauseCampaignMutation.isPending}
                            >
                              <Pause className="h-4 w-4 mr-1" />
                              Pause
                            </Button>
                          )}
                          {campaign.status === "paused" && (
                            <Button 
                              size="sm"
                              onClick={() => resumeCampaignMutation.mutate(campaign.id)}
                              disabled={resumeCampaignMutation.isPending}
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Resume
                            </Button>
                          )}
                          {(campaign.status === "completed" || campaign.status === "failed") && (
                            <Button 
                              size="sm"
                              variant="outline"
                              onClick={() => cloneCampaignMutation.mutate(campaign)}
                              disabled={cloneCampaignMutation.isPending}
                            >
                              <Copy className="h-4 w-4 mr-1" />
                              Clone & Reuse
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="outline">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => cloneCampaignMutation.mutate(campaign)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Clone Campaign
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

                        {/* Progress Section */}
                        {campaign.totalTargets > 0 && (
                          <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-medium">Progress</span>
                              <span className="text-muted-foreground">
                                {campaign.sentCount + campaign.failedCount} / {campaign.totalTargets} 
                                ({Math.round(((campaign.sentCount + campaign.failedCount) / campaign.totalTargets) * 100)}%)
                              </span>
                            </div>
                            <Progress 
                              value={((campaign.sentCount + campaign.failedCount) / campaign.totalTargets) * 100}
                              className="h-3"
                            />
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
                            <span className="font-medium">Target Type:</span>
                            <p className="text-muted-foreground capitalize">
                              {campaign.targetType.replace("_", " ")}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium">Total Targets:</span>
                            <p className="text-muted-foreground">{campaign.totalTargets}</p>
                          </div>
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
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Schedule:</span>
                            <p className="text-muted-foreground capitalize">
                              {campaign.scheduleType.replace("_", " ")}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium">Interval:</span>
                            <p className="text-muted-foreground">
                              {campaign.minInterval}-{campaign.maxInterval}s
                            </p>
                          </div>
                          {campaign.timePost && (
                            <div>
                              <span className="font-medium">Scheduled For:</span>
                              <p className="text-muted-foreground">
                                {formatDate(campaign.timePost.toString())}
                              </p>
                            </div>
                          )}
                          {campaign.mediaUrl && (
                            <div>
                              <span className="font-medium">Media:</span>
                              <p className="text-muted-foreground capitalize">
                                {campaign.mediaType || "Attached"}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {campaigns.length}
                  </div>
                  <p className="text-sm text-muted-foreground">Total Campaigns</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {campaigns.reduce((sum, c) => sum + c.sentCount, 0)}
                  </div>
                  <p className="text-sm text-muted-foreground">Messages Sent</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {campaigns.reduce((sum, c) => sum + c.failedCount, 0)}
                  </div>
                  <p className="text-sm text-muted-foreground">Failed Messages</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}