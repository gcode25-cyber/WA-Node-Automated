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
import { Plus, Play, Pause, RotateCcw, Eye, Upload, Send, Calendar, Clock, Target, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { BulkMessageCampaign, ContactGroup } from "@shared/schema";

interface Group {
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

  // Campaign form state
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    message: "",
    targetType: "contact_group",
    contactGroupId: "",
    whatsappGroupId: "",
    scheduleType: "immediate",
    timePost: "",
    scheduleHours: [] as string[],
    minInterval: 1,
    maxInterval: 10
  });

  // Fetch campaigns
  const { data: campaigns = [], isLoading: campaignsLoading, refetch: refetchCampaigns } = useQuery<BulkMessageCampaign[]>({
    queryKey: ["/api/bulk-campaigns"],
    enabled: true
  });

  // Fetch contact groups
  const { data: contactGroups = [] } = useQuery<ContactGroup[]>({
    queryKey: ["/api/contact-groups"],
    enabled: campaignForm.targetType === "contact_group"
  });

  // Fetch WhatsApp groups
  const { data: whatsappGroups = [] } = useQuery<Group[]>({
    queryKey: ["/api/groups"],
    enabled: campaignForm.targetType === "whatsapp_group"
  });

  // Fetch campaign targets preview
  const { data: campaignTargets = [] } = useQuery<Array<{id: string, name?: string, count?: number}>>({
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

  // Campaign control mutations
  const executeCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      return apiRequest(`/api/campaigns/${campaignId}/execute`, "POST");
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Campaign Started", 
        description: `Executing ${data.totalTargets} targets. Estimated duration: ${data.estimatedDuration}` 
      });
      refetchCampaigns();
    }
  });

  const pauseCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      return apiRequest(`/api/campaigns/${campaignId}/pause`, "POST");
    },
    onSuccess: () => {
      toast({ title: "Campaign Paused", description: "Campaign execution paused" });
      refetchCampaigns();
    }
  });

  const resumeCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      return apiRequest(`/api/campaigns/${campaignId}/resume`, "POST");
    },
    onSuccess: () => {
      toast({ title: "Campaign Resumed", description: "Campaign execution resumed" });
      refetchCampaigns();
    }
  });

  const resetForm = () => {
    setCampaignForm({
      name: "",
      message: "",
      targetType: "contact_group",
      contactGroupId: "",
      whatsappGroupId: "",
      scheduleType: "immediate",
      timePost: "",
      scheduleHours: [],
      minInterval: 1,
      maxInterval: 10
    });
    setSelectedFile(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
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
                    onValueChange={(value) => setCampaignForm(prev => ({ ...prev, targetType: value }))}
                  >
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
                            {group.name} ({group.validContacts} contacts)
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
                        {whatsappGroups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name} ({group.participants?.length || 0} members)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {campaignTargets.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Target Preview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {campaignTargets.map((target) => (
                        <div key={target.id} className="flex justify-between items-center py-2">
                          <span>{target.name}</span>
                          <Badge variant="outline">{target.count} targets</Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
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
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">Send Immediately</SelectItem>
                      <SelectItem value="scheduled">Schedule for Specific Time</SelectItem>
                      <SelectItem value="daytime">Daytime Hours (6AM-6PM)</SelectItem>
                      <SelectItem value="nighttime">Nighttime Hours (7PM-5AM)</SelectItem>
                      <SelectItem value="odd_hours">Odd Hours Only</SelectItem>
                      <SelectItem value="even_hours">Even Hours Only</SelectItem>
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
                            <p className="text-muted-foreground">{campaign.sentCount}</p>
                          </div>
                          <div>
                            <span className="font-medium">Failed:</span>
                            <p className="text-muted-foreground">{campaign.failedCount}</p>
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