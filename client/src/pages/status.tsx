import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Image, Video, FileText, Link as LinkIcon, User, Plus } from 'lucide-react';
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
  const { data: statusUpdates = [], isLoading: statusLoading, error: statusError } = useQuery<StatusUpdate[]>({
    queryKey: ['/api/status'],
    refetchInterval: 30000,
  });

  // Get most recent status per contact for list view
  const latestStatuses = statusUpdates.reduce((acc: Record<string, StatusUpdate>, status) => {
    const authorKey = status.authorName || status.author;
    if (!acc[authorKey] || status.timestamp > acc[authorKey].timestamp) {
      acc[authorKey] = status;
    }
    return acc;
  }, {});

  const statusList = Object.values(latestStatuses).sort((a, b) => b.timestamp - a.timestamp);

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

  console.log('Status page rendering:', { statusLoading, statusUpdates, statusError, statusList });

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading status updates...</p>
        </div>
      </div>
    );
  }

  if (statusError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-500 mb-4">Error loading status updates</p>
          <Button onClick={() => setLocation('/dashboard?module=status')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-green-600 dark:bg-green-700 text-white p-4">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => setLocation('/dashboard?module=status')}
            className="text-white hover:bg-green-700 dark:hover:bg-green-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-medium">Status</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto bg-white dark:bg-gray-800">
        {/* My Status Section */}
        <div className="p-4 border-b dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                <User className="h-7 w-7 text-gray-500 dark:text-gray-400" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <Plus className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">My status</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Tap to add status update</p>
            </div>
          </div>
        </div>

        {/* Recent Updates */}
        <div className="p-4">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            RECENT
          </h4>
          
          {statusLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            </div>
          ) : statusList.length === 0 ? (
            <div className="text-center py-8">
              <User className="h-8 w-8 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No status updates available
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {statusList.map((status) => (
                <div
                  key={status.id}
                  className="flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
                  onClick={() => handleStatusClick(status)}
                  data-testid={`status-item-${status.id}`}
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 p-0.5">
                      <div className="w-full h-full rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                        <User className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                      </div>
                    </div>
                    {status.hasMedia && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center">
                        {getMediaIcon(status.mediaType)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {status.authorName}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDistanceToNow(new Date(status.timestamp * 1000), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Status Detail Dialog - Full Screen Mobile Style */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent className="max-w-md w-full h-full max-h-screen m-0 rounded-none p-0 bg-black text-white">
          <div className="relative h-full flex flex-col">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  onClick={() => setShowStatusDialog(false)}
                  className="text-white hover:bg-white/20 p-2"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1 mx-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm">{selectedStatus?.authorName}</h3>
                      <p className="text-xs text-gray-300">
                        {selectedStatus && formatDistanceToNow(new Date(selectedStatus.timestamp * 1000), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex items-center justify-center p-4 pt-20">
              {selectedStatus && (
                <div className="w-full max-w-sm text-center">
                  {selectedStatus.hasMedia ? (
                    <div className="bg-gray-800 rounded-lg p-8 mb-4">
                      <div className="flex flex-col items-center space-y-4">
                        <div className="text-4xl">
                          {selectedStatus.mediaType === 'image' && '🖼️'}
                          {selectedStatus.mediaType === 'video' && '🎥'}
                          {selectedStatus.mediaType === 'document' && '📄'}
                        </div>
                        <p className="text-sm text-gray-300">
                          {selectedStatus.mediaType} content
                        </p>
                        <p className="text-xs text-gray-400">
                          Media preview not available
                        </p>
                      </div>
                    </div>
                  ) : null}
                  
                  {selectedStatus.body && (
                    <div className="bg-gray-800/80 rounded-lg p-4 mb-4">
                      <p className="text-white whitespace-pre-wrap text-lg leading-relaxed">
                        {selectedStatus.body}
                      </p>
                    </div>
                  )}
                  
                  {selectedStatus.links && selectedStatus.links.length > 0 && (
                    <div className="bg-gray-800/80 rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-center space-x-2 mb-3">
                        <LinkIcon className="h-4 w-4" />
                        <span className="text-sm">Links</span>
                      </div>
                      {selectedStatus.links.map((link, index) => (
                        <a
                          key={index}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm text-blue-400 hover:text-blue-300 underline break-all"
                        >
                          {link}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}