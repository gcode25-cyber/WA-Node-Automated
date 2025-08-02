import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { StatusBanner } from "@/components/ui/status-banner";
import { AuthenticationCard } from "@/components/ui/authentication-card";
import { UserProfileCard } from "@/components/ui/user-profile-card";
import { useLocation } from "wouter";

import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SessionInfo } from "@shared/schema";

export default function AccountManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Fetch session info - much slower polling to reduce requests
  const { data: sessionInfo, isLoading: sessionLoading, error: sessionError } = useQuery({
    queryKey: ['/api/session-info'],
    refetchInterval: 10000, // Poll every 10 seconds
    staleTime: 8000, // Cache for 8 seconds
    retry: false, // Don't retry on 404 (no session)
  });

  // Fetch QR code only when needed - poll when no session
  const { data: qrData, isLoading: qrLoading, refetch: refetchQR } = useQuery<{qr?: string | null}>({
    queryKey: ['/api/get-qr'],
    enabled: !sessionInfo, // Only enabled when no session
    refetchInterval: !sessionInfo ? 5000 : false, // Poll every 5s when no session
    staleTime: 3000, // Cache QR for 3 seconds
  });

  // Fetch system status - less frequent updates
  const { data: systemStatus } = useQuery<{client: string; puppeteer: string; storage: string; lastCheck: string}>({
    queryKey: ['/api/system-status'],
    refetchInterval: 60000, // Update every 60 seconds
    staleTime: 50000, // Cache for 50 seconds
  });

  // Logout mutation with automated session clearing and QR refresh
  const logoutMutation = useMutation({
    mutationFn: () => apiRequest('/api/logout', 'POST'),
    onSuccess: () => {
      // Automatically clear stored authentication and all session data
      queryClient.clear();
      sessionStorage.clear();
      localStorage.clear();
      
      // Immediately invalidate and refetch to get new QR code
      queryClient.invalidateQueries({ queryKey: ['/api/session-info'] });
      queryClient.invalidateQueries({ queryKey: ['/api/get-qr'] });
      
      // Force refresh QR code to ensure new one is generated
      apiRequest('/api/refresh-qr', 'POST').then(() => {
        // After QR refresh, refetch the new QR code
        setTimeout(() => {
          queryClient.refetchQueries({ queryKey: ['/api/get-qr'] });
          queryClient.refetchQueries({ queryKey: ['/api/session-info'] });
        }, 2000);
      }).catch((refreshError) => {
        console.error("QR refresh error:", refreshError);
        // Still try to refetch even if refresh fails
        setTimeout(() => {
          queryClient.refetchQueries({ queryKey: ['/api/get-qr'] });
          queryClient.refetchQueries({ queryKey: ['/api/session-info'] });
        }, 2000);
      });
      
      toast({
        title: "Success",
        description: "Successfully logged out from WhatsApp. New QR code is being generated...",
      });
    },
    onError: (error: any) => {
      // Logout should always clear session even if there's an error
      queryClient.clear();
      sessionStorage.clear();
      localStorage.clear();
      
      queryClient.invalidateQueries({ queryKey: ['/api/session-info'] });
      queryClient.invalidateQueries({ queryKey: ['/api/get-qr'] });
      
      // Force QR refresh even on error
      apiRequest('/api/refresh-qr', 'POST').then(() => {
        setTimeout(() => {
          queryClient.refetchQueries({ queryKey: ['/api/get-qr'] });
          queryClient.refetchQueries({ queryKey: ['/api/session-info'] });
        }, 2000);
      }).catch(() => {
        // Force refetch even on refresh error
        setTimeout(() => {
          queryClient.refetchQueries({ queryKey: ['/api/get-qr'] });
          queryClient.refetchQueries({ queryKey: ['/api/session-info'] });
        }, 2000);
      });
      
      toast({
        title: "Logged Out",
        description: "Session cleared automatically. New QR code is being generated.",
      });
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleRefreshQR = async () => {
    try {
      // Call the backend to force refresh QR
      await apiRequest('/api/refresh-qr', 'POST');
      
      // Wait a moment for QR to generate, then refetch
      setTimeout(() => {
        refetchQR();
        queryClient.invalidateQueries({ queryKey: ['/api/get-qr'] });
      }, 1000);
      
      toast({
        title: "QR Code Refreshed", 
        description: "A new QR code is being generated",
      });
    } catch (error) {
      console.error('QR refresh error:', error);
      // Still try to refetch in case it works
      refetchQR();
      toast({
        title: "QR Refresh Attempted",
        description: "Attempting to generate new QR code",
      });
    }
  };

  const handleRetryConnection = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/session-info'] });
    queryClient.invalidateQueries({ queryKey: ['/api/get-qr'] });
  };

  // Store user name when connected but don't auto-redirect
  useEffect(() => {
    if (sessionInfo && (sessionInfo as any).name && (sessionInfo as any).name !== "Fetching..." && (sessionInfo as any).name !== "WhatsApp User") {
      // Store last user name for re-login feature
      localStorage.setItem('lastWhatsAppUser', (sessionInfo as any).name);
      
      // Don't auto-redirect - let user manually go to dashboard
      // Users can manually click to go to dashboard when ready
    }
  }, [sessionInfo]);

  return (
    <div className="bg-background font-sans min-h-screen">
      {/* Header */}
      <header className="bg-surface shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <svg className="w-8 h-8 text-green-500 mr-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893A11.821 11.821 0 0020.893 3.506z"/>
              </svg>
              <h1 className="text-xl font-semibold text-foreground">WhatsApp Web Automation</h1>
            </div>
            <nav className="flex items-center space-x-4">
              <Button variant="ghost" size="sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Full Screen Authentication Card */}
        <div className="w-full">
          <AuthenticationCard
            sessionInfo={sessionInfo}
            qrData={qrData}
            isLoading={sessionLoading || qrLoading}
            isLogoutPending={logoutMutation.isPending}
            onLogout={handleLogout}
            onRefreshQR={handleRefreshQR}
            onRetryConnection={handleRetryConnection}
            lastUserName={localStorage.getItem('lastWhatsAppUser') || undefined}
          />
        </div>
      </main>
    </div>
  );
}
