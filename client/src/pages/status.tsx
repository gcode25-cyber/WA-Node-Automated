import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Eye, Image, Video, FileText, Link as LinkIcon, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface StatusUpdate {
  id: string;
  author: string;
  authorName: string;
  body: string;
  timestamp: number;
  type: string;
  hasMedia: boolean;
  mediaType: string;
  links: string[];
}

export default function StatusPage() {
  const [, setLocation] = useLocation();
  const [selectedStatus, setSelectedStatus] = useState<StatusUpdate | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);

  // Fetch status updates
  const { data: statusUpdates = [], isLoading: statusLoading } = useQuery<StatusUpdate[]>({
    queryKey: ['/api/status'],
    refetchInterval: 30000,
  });

  // Group status updates by author
  const groupedStatuses = statusUpdates.reduce((acc: Record<string, StatusUpdate[]>, status) => {
    const authorKey = status.authorName || status.author;
    if (!acc[authorKey]) {
      acc[authorKey] = [];
    }
    acc[authorKey].push(status);
    return acc;
  }, {});

  const handleStatusClick = (status: StatusUpdate) => {
    setSelectedStatus(status);
    setShowStatusDialog(true);
  };

  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <Image className="h-4 w-4" />;
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'document':
        return <FileText className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusTypeColor = (type: string) => {
    switch (type) {
      case 'image':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'video':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'document':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const formatPhoneNumber = (author: string): string => {
    if (typeof author === 'string' && author.includes('@')) {
      const phoneNumber = author.split('@')[0];
      if (phoneNumber.length > 7) {
        return phoneNumber.replace(/^(\d{1,3})(\d{3,4})(\d{3,4})(\d{4})$/, '+$1 $2 $3 $4');
      }
      return phoneNumber;
    }
    return author || 'Unknown';
  };

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => setLocation('/dashboard?module=status')}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">WhatsApp Status Updates</h1>
              <p className="text-muted-foreground">
                View status updates from your contacts
              </p>
            </div>
          </div>
        </div>

        {/* Status Updates */}
        <div className="space-y-6">
          {Object.keys(groupedStatuses).length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Status Updates</h3>
                  <p className="text-muted-foreground">
                    Status updates from your contacts will appear here.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            Object.entries(groupedStatuses).map(([authorName, statuses]) => (
              <Card key={authorName} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-full bg-green-200 dark:bg-green-700 flex items-center justify-center">
                        <User className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{authorName}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {formatPhoneNumber(statuses[0].author)}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {statuses.length} update{statuses.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {statuses.map((status) => (
                      <div
                        key={status.id}
                        className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer group"
                        onClick={() => handleStatusClick(status)}
                        data-testid={`status-card-${status.id}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {status.hasMedia && getMediaIcon(status.mediaType)}
                            <Badge 
                              className={`text-xs ${getStatusTypeColor(status.type)}`}
                              variant="secondary"
                            >
                              {status.type || 'text'}
                            </Badge>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        {status.body && (
                          <p className="text-sm mb-3 line-clamp-3">
                            {status.body}
                          </p>
                        )}
                        
                        {status.links && status.links.length > 0 && (
                          <div className="flex items-center space-x-1 mb-3">
                            <LinkIcon className="h-3 w-3 text-blue-500" />
                            <span className="text-xs text-blue-500">
                              {status.links.length} link{status.links.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                        
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(status.timestamp * 1000), { addSuffix: true })}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Status Detail Dialog */}
        <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>{selectedStatus?.authorName}</span>
                {selectedStatus?.hasMedia && (
                  <Badge className={getStatusTypeColor(selectedStatus.type)} variant="secondary">
                    {selectedStatus.type}
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            
            {selectedStatus && (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  {formatPhoneNumber(selectedStatus.author)} • {' '}
                  {formatDistanceToNow(new Date(selectedStatus.timestamp * 1000), { addSuffix: true })}
                </div>
                
                {selectedStatus.body && (
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="whitespace-pre-wrap">{selectedStatus.body}</p>
                  </div>
                )}
                
                {selectedStatus.hasMedia && (
                  <div className="bg-muted/30 rounded-lg p-4 text-center">
                    <div className="flex flex-col items-center space-y-2">
                      {getMediaIcon(selectedStatus.mediaType)}
                      <p className="text-sm text-muted-foreground">
                        Media content ({selectedStatus.mediaType})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Media preview not available in this view
                      </p>
                    </div>
                  </div>
                )}
                
                {selectedStatus.links && selectedStatus.links.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center space-x-2">
                      <LinkIcon className="h-4 w-4" />
                      <span>Links</span>
                    </h4>
                    <div className="space-y-1">
                      {selectedStatus.links.map((link, index) => (
                        <a
                          key={index}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm text-blue-500 hover:text-blue-700 underline break-all"
                        >
                          {link}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}