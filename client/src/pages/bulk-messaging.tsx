import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Users, Clock, Send, Play, Pause, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Campaign {
  id: number;
  title: string;
  message: string;
  targetType: string;
  status: string;
  sentCount: number;
  totalCount: number;
  createdAt: string;
}

interface ContactGroup {
  id: number;
  name: string;
  memberCount: number;
}

export default function BulkMessaging() {
  const { toast } = useToast();
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [campaignTitle, setCampaignTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetType, setTargetType] = useState("contact_groups");

  // Fetch campaigns
  const { data: campaigns, isLoading: campaignsLoading } = useQuery<Campaign[]>({
    queryKey: ['/api/bulk-campaigns'],
  });

  // Fetch contact groups
  const { data: contactGroups, isLoading: groupsLoading } = useQuery<ContactGroup[]>({
    queryKey: ['/api/contact-groups'],
  });

  // Create campaign mutation
  const createCampaignMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/bulk-campaigns', 'POST', data),
    onSuccess: () => {
      toast({ title: "Campaign created successfully!" });
      queryClient.invalidateQueries({ queryKey: ['/api/bulk-campaigns'] });
      // Reset form
      setCampaignTitle("");
      setMessage("");
      setSelectedGroupId("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create campaign", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  // Start campaign mutation
  const startCampaignMutation = useMutation({
    mutationFn: (campaignId: number) => apiRequest(`/api/bulk-campaigns/${campaignId}/start`, 'POST'),
    onSuccess: () => {
      toast({ title: "Campaign started!" });
      queryClient.invalidateQueries({ queryKey: ['/api/bulk-campaigns'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to start campaign", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  // Restart campaign mutation
  const restartCampaignMutation = useMutation({
    mutationFn: (campaignId: number) => apiRequest(`/api/bulk-campaigns/${campaignId}/restart`, 'POST'),
    onSuccess: () => {
      toast({ title: "Campaign restarted!" });
      queryClient.invalidateQueries({ queryKey: ['/api/bulk-campaigns'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to restart campaign", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const handleCreateCampaign = () => {
    if (!campaignTitle.trim() || !message.trim() || !selectedGroupId) {
      toast({
        title: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    createCampaignMutation.mutate({
      title: campaignTitle,
      message,
      targetType,
      targetId: parseInt(selectedGroupId),
      scheduledAt: new Date().toISOString()
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { variant: "secondary" as const, text: "Draft" },
      running: { variant: "default" as const, text: "Running" },
      completed: { variant: "default" as const, text: "Completed" },
      paused: { variant: "outline" as const, text: "Paused" },
      failed: { variant: "destructive" as const, text: "Failed" }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Badge variant={config.variant}>{config.text}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background p-4 overflow-y-auto" data-testid="bulk-messaging-page">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="page-title">
              Bulk Messaging
            </h1>
            <p className="text-muted-foreground mt-1">
              Create and manage bulk WhatsApp campaigns
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Campaign Creation Form */}
          <div className="lg:col-span-1">
            <Card data-testid="create-campaign-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Create Campaign
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Campaign Title</label>
                  <Input
                    placeholder="Enter campaign title"
                    value={campaignTitle}
                    onChange={(e) => setCampaignTitle(e.target.value)}
                    data-testid="input-campaign-title"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Target Type</label>
                  <Select value={targetType} onValueChange={setTargetType}>
                    <SelectTrigger data-testid="select-target-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contact_groups">Contact Groups</SelectItem>
                      <SelectItem value="local_contacts">Local Contacts</SelectItem>
                      <SelectItem value="whatsapp_groups">WhatsApp Groups</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {targetType === "contact_groups" && (
                  <div>
                    <label className="text-sm font-medium">Contact Group</label>
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                      <SelectTrigger data-testid="select-contact-group">
                        <SelectValue placeholder="Select a group" />
                      </SelectTrigger>
                      <SelectContent>
                        {contactGroups?.map((group) => (
                          <SelectItem key={group.id} value={group.id.toString()}>
                            {group.name} ({group.memberCount} contacts)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium">Message</label>
                  <Textarea
                    placeholder="Type your message here..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    data-testid="input-message"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {message.length}/1000 characters
                  </p>
                </div>

                <Button
                  onClick={handleCreateCampaign}
                  className="w-full"
                  disabled={createCampaignMutation.isPending}
                  data-testid="button-create-campaign"
                >
                  {createCampaignMutation.isPending ? "Creating..." : "Create Campaign"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Campaigns List */}
          <div className="lg:col-span-2">
            <Card data-testid="campaigns-list-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Campaigns ({campaigns?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-[70vh] overflow-y-auto">
                {campaignsLoading ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading campaigns...</p>
                  </div>
                ) : !campaigns || campaigns.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageCircle className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No campaigns created yet</p>
                    <p className="text-sm text-muted-foreground">
                      Create your first bulk messaging campaign
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {campaigns.map((campaign) => (
                      <div
                        key={campaign.id}
                        className="border rounded-lg p-4 space-y-3"
                        data-testid={`campaign-${campaign.id}`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg" data-testid={`campaign-title-${campaign.id}`}>
                              {campaign.title}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {campaign.targetType.replace('_', ' ')} • Created {new Date(campaign.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(campaign.status)}
                          </div>
                        </div>

                        <div className="bg-muted p-3 rounded text-sm" data-testid={`campaign-message-${campaign.id}`}>
                          {campaign.message}
                        </div>

                        {campaign.status === 'running' || campaign.status === 'completed' ? (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span data-testid={`campaign-progress-text-${campaign.id}`}>
                                {campaign.sentCount} of {campaign.totalCount} sent
                              </span>
                              <span>{Math.round((campaign.sentCount / campaign.totalCount) * 100)}%</span>
                            </div>
                            <Progress 
                              value={(campaign.sentCount / campaign.totalCount) * 100}
                              data-testid={`campaign-progress-${campaign.id}`}
                            />
                            {campaign.status === 'completed' && (
                              <div className="flex gap-2 mt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => restartCampaignMutation.mutate(campaign.id)}
                                  disabled={restartCampaignMutation.isPending}
                                  data-testid={`button-restart-campaign-${campaign.id}`}
                                >
                                  <RotateCcw className="w-4 h-4 mr-1" />
                                  Restart
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => startCampaignMutation.mutate(campaign.id)}
                              disabled={startCampaignMutation.isPending}
                              data-testid={`button-start-campaign-${campaign.id}`}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Start
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}