import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SystemStatusCardProps {
  systemStatus?: {
    client: string;
    puppeteer: string;
    storage: string;
    lastCheck: string;
  };
}

export function SystemStatusCard({ systemStatus }: SystemStatusCardProps) {
  const formatLastCheck = (timestamp?: string) => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes === 1) return "1 minute ago";
    return `${diffMinutes} minutes ago`;
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'running':
      case 'stable':
      case 'active':
        return 'bg-green-500';
      case 'initializing':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <Card>
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground flex items-center">
          <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          System Status
        </h3>
      </div>
      
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">WhatsApp Client</span>
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${systemStatus?.client === 'Running' ? 'animate-pulse' : ''} ${getStatusColor(systemStatus?.client || '')}`}></div>
              <Badge variant={systemStatus?.client === 'Running' ? 'default' : 'secondary'}>
                {systemStatus?.client || 'Unknown'}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Puppeteer</span>
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${getStatusColor(systemStatus?.puppeteer || '')}`}></div>
              <Badge variant="default">
                {systemStatus?.puppeteer || 'Unknown'}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Session Storage</span>
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${getStatusColor(systemStatus?.storage || '')}`}></div>
              <Badge variant="default">
                {systemStatus?.storage || 'Unknown'}
              </Badge>
            </div>
          </div>
          
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Last checked: {formatLastCheck(systemStatus?.lastCheck)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
