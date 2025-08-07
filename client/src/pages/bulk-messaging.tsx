import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Play, Pause, Copy, RefreshCw, Send, MessageSquare, BarChart3, Trash2, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { BulkMessageCampaign } from "@shared/schema";

export default function BulkMessaging() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("campaigns");
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    message: "",
    targetType: "whatsapp_group",
    whatsappGroupId: "",
    scheduleType: "immediate",
    minInterval: 40,
    maxInterval: 100
  });

  // Fetch campaigns with auto-refresh
  const { data: campaigns = [], isLoading: campaignsLoading, refetch: refetchCampaigns } = useQuery<BulkMessageCampaign[]>({
    queryKey: ["/api/bulk-campaigns"],
    enabled: true,
    refetchInterval: autoRefresh ? 3000 : false,
    refetchIntervalInBackground: true
  });

  // Fetch WhatsApp groups
  const { data: whatsappGroups = [] } = useQuery<any[]>({
    queryKey: ["/api/groups"],
    enabled: true
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
      setIsCreateFormOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/bulk-campaigns"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create campaign", variant: "destructive" });
    }
  });

  // Execute campaign mutation
  const executeCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await fetch(`/api/campaigns/${campaignId}/execute`, {
        method: "POST"
      });
      if (!response.ok) throw new Error('Failed to start campaign');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Campaign started successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/bulk-campaigns"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to start campaign", variant: "destructive" });
    }
  });

  // Restart campaign mutation (creates a copy with same settings)
  const restartCampaignMutation = useMutation({
    mutationFn: async (campaign: BulkMessageCampaign) => {
      const formData = new FormData();
      formData.append("name", campaign.name);
      formData.append("message", campaign.message);
      formData.append("targetType", campaign.targetType);
      formData.append("scheduleType", campaign.scheduleType);
      formData.append("minInterval", campaign.minInterval.toString());
      formData.append("maxInterval", campaign.maxInterval.toString());
      if (campaign.whatsappGroupId) formData.append("whatsappGroupId", campaign.whatsappGroupId);
      
      const response = await fetch("/api/campaigns/create", {
        method: "POST",
        body: formData
      });
      if (!response.ok) throw new Error('Failed to restart campaign');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Campaign restarted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/bulk-campaigns"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to restart campaign", variant: "destructive" });
    }
  });

  // Delete campaign mutation
  const deleteCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error('Failed to delete campaign');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Campaign deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/bulk-campaigns"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete campaign", variant: "destructive" });
    }
  });

  const resetForm = () => {
    setCampaignForm({
      name: "",
      message: "",
      targetType: "whatsapp_group",
      whatsappGroupId: "",
      scheduleType: "immediate",
      minInterval: 40,
      maxInterval: 100
    });
  };

  const handleCreateCampaign = async () => {
    if (!campaignForm.name || !campaignForm.message || !campaignForm.whatsappGroupId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("name", campaignForm.name);
    formData.append("message", campaignForm.message);
    formData.append("targetType", campaignForm.targetType);
    formData.append("whatsappGroupId", campaignForm.whatsappGroupId);
    formData.append("scheduleType", campaignForm.scheduleType);
    formData.append("minInterval", campaignForm.minInterval.toString());
    formData.append("maxInterval", campaignForm.maxInterval.toString());

    createCampaignMutation.mutate(formData);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-100 text-gray-800";
      case "running": return "bg-blue-100 text-blue-800";
      case "paused": return "bg-yellow-100 text-yellow-800";
      case "completed": return "bg-green-100 text-green-800";
      case "failed": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const runningCampaigns = campaigns.filter(c => c.status === "running");
  const completedCampaigns = campaigns.filter(c => c.status === "completed");
  const totalMessagesSent = campaigns.reduce((sum, c) => sum + c.sentCount, 0);
  const totalMessagesFailed = campaigns.reduce((sum, c) => sum + c.failedCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bulk Messaging</h1>
          <p className="text-muted-foreground">Create and manage bulk WhatsApp messaging campaigns</p>
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
          <Button onClick={() => setIsCreateFormOpen(!isCreateFormOpen)}>
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Campaigns</p>
              <p className="text-2xl font-bold">{campaigns.length}</p>
            </div>
            <MessageSquare className="h-8 w-8 text-blue-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Campaigns</p>
              <p className="text-2xl font-bold text-blue-600">{runningCampaigns.length}</p>
            </div>
            <Play className="h-8 w-8 text-blue-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Messages Sent</p>
              <p className="text-2xl font-bold text-green-600">{totalMessagesSent}</p>
            </div>
            <Send className="h-8 w-8 text-green-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
              <p className="text-2xl font-bold text-green-600">
                {totalMessagesSent + totalMessagesFailed > 0 
                  ? Math.round((totalMessagesSent / (totalMessagesSent + totalMessagesFailed)) * 100) 
                  : 0}%
              </p>
            </div>
            <BarChart3 className="h-8 w-8 text-green-500" />
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="create">Create Campaign</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <div className="space-y-4">
            {campaignsLoading ? (
              <div className="text-center py-8">Loading campaigns...</div>
            ) : campaigns.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
                  <p className="text-muted-foreground mb-4">Create your first bulk messaging campaign</p>
                  <Button onClick={() => setActiveTab("create")}>
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
                          {(campaign.status === "completed" || campaign.status === "failed") && (
                            <>
                              <Button 
                                size="sm"
                                variant="outline"
                                onClick={() => restartCampaignMutation.mutate(campaign)}
                                disabled={restartCampaignMutation.isPending}
                              >
                                <RotateCcw className="h-4 w-4 mr-1" />
                                Restart
                              </Button>
                              <Button 
                                size="sm"
                                variant="outline"
                                onClick={() => deleteCampaignMutation.mutate(campaign.id)}
                                disabled={deleteCampaignMutation.isPending}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </>
                          )}
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
                                {campaign.sentCount} / {campaign.totalTargets} 
                                ({Math.round((campaign.sentCount / campaign.totalTargets) * 100)}%)
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                                style={{
                                  width: `${(campaign.sentCount / campaign.totalTargets) * 100}%`
                                }}
                              ></div>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-green-600 font-medium">✓ {campaign.sentCount} sent</span>
                              <span className="text-red-600 font-medium">✗ {campaign.failedCount} failed</span>
                              <span className="text-blue-600 font-medium">⏳ {campaign.totalTargets - campaign.sentCount} remaining</span>
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
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Create New Bulk Messaging Campaign</CardTitle>
              <p className="text-sm text-muted-foreground">
                Set up a new bulk messaging campaign to send messages to multiple WhatsApp groups or contacts
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Campaign Name</label>
                  <Input
                    placeholder="Enter campaign name"
                    value={campaignForm.name}
                    onChange={(e) => setCampaignForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">WhatsApp Group</label>
                  <select 
                    className="w-full p-2 border rounded-md"
                    value={campaignForm.whatsappGroupId}
                    onChange={(e) => setCampaignForm(prev => ({ ...prev, whatsappGroupId: e.target.value }))}
                  >
                    <option value="">Select WhatsApp group</option>
                    {whatsappGroups.filter(group => group.isGroup).map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Message Content</label>
                <Textarea
                  placeholder="Type your message here..."
                  rows={4}
                  value={campaignForm.message}
                  onChange={(e) => setCampaignForm(prev => ({ ...prev, message: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Min Interval (seconds)</label>
                  <Input
                    type="number"
                    min="1"
                    max="300"
                    value={campaignForm.minInterval}
                    onChange={(e) => setCampaignForm(prev => ({ ...prev, minInterval: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max Interval (seconds)</label>
                  <Input
                    type="number"
                    min="1"
                    max="300"
                    value={campaignForm.maxInterval}
                    onChange={(e) => setCampaignForm(prev => ({ ...prev, maxInterval: parseInt(e.target.value) || 10 }))}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    resetForm();
                    setActiveTab("campaigns");
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateCampaign}
                  disabled={createCampaignMutation.isPending}
                >
                  {createCampaignMutation.isPending ? "Creating..." : "Create Campaign"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Performance Overview</CardTitle>
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
                      {totalMessagesSent}
                    </div>
                    <p className="text-sm text-muted-foreground">Messages Sent</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-600">
                      {totalMessagesFailed}
                    </div>
                    <p className="text-sm text-muted-foreground">Failed Messages</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Campaign Status Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600">
                      {campaigns.filter(c => c.status === "draft").length}
                    </div>
                    <p className="text-sm text-muted-foreground">Draft</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {campaigns.filter(c => c.status === "running").length}
                    </div>
                    <p className="text-sm text-muted-foreground">Running</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {campaigns.filter(c => c.status === "completed").length}
                    </div>
                    <p className="text-sm text-muted-foreground">Completed</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {campaigns.filter(c => c.status === "failed").length}
                    </div>
                    <p className="text-sm text-muted-foreground">Failed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}