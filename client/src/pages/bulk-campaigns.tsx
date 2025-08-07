import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Pause, Copy, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { BulkMessageCampaign } from "@shared/schema";

export default function BulkCampaigns() {
  const { toast } = useToast();
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
      if (campaign.whatsappGroupId) formData.append("whatsappGroupId", campaign.whatsappGroupId);
      
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

  const handleCreateCampaign = () => {
    if (!campaignForm.name || !campaignForm.message) {
      toast({ title: "Error", description: "Campaign name and message are required", variant: "destructive" });
      return;
    }

    if (!campaignForm.whatsappGroupId) {
      toast({ title: "Error", description: "Please select a WhatsApp group", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    Object.entries(campaignForm).forEach(([key, value]) => {
      formData.append(key, value.toString());
    });

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
          <Button onClick={() => setIsCreateFormOpen(!isCreateFormOpen)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Campaign
          </Button>
        </div>
      </div>

      {/* Create Campaign Form */}
      {isCreateFormOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Campaign</CardTitle>
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
              <label className="text-sm font-medium">Message</label>
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
              <Button variant="outline" onClick={() => setIsCreateFormOpen(false)}>
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
      )}

      {/* Campaigns List */}
      <div className="space-y-4">
        {campaignsLoading ? (
          <div className="text-center py-8">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
              <p className="text-muted-foreground mb-4">Create your first bulk messaging campaign</p>
              <Button onClick={() => setIsCreateFormOpen(true)}>
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
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                            style={{
                              width: `${((campaign.sentCount + campaign.failedCount) / campaign.totalTargets) * 100}%`
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Analytics Summary */}
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
    </div>
  );
}