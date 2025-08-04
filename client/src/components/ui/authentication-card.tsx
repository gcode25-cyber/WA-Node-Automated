import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserProfileCard } from "@/components/ui/user-profile-card";
import { Loader2, RefreshCw, Smartphone, CheckCircle, AlertTriangle, RotateCcw, Bug, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { useLocation } from "wouter";
import type { SessionInfo } from "@shared/schema";

interface AuthenticationCardProps {
  sessionInfo?: any;
  qrData?: { qr?: string | null };
  isLoading: boolean;
  isLogoutPending: boolean;
  onLogout: () => void;
  onRefreshQR: () => void;
  onRetryConnection: () => void;
  lastUserName?: string;
}

export function AuthenticationCard({
  sessionInfo,
  qrData,
  isLoading,
  isLogoutPending,
  onLogout,
  onRefreshQR,
  onRetryConnection,
  lastUserName,
}: AuthenticationCardProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const showQRSection = !sessionInfo && !isLoading && qrData?.qr && qrData.qr !== null && !isLogoutPending;
  const showAuthenticatedSection = sessionInfo && sessionInfo.name;
  const showLoadingSection = isLoading || isLogoutPending;
  const showQRGeneratingSection = !sessionInfo && !isLoading && !isLogoutPending && (!qrData?.qr || qrData?.qr === null);
  const showErrorSection = false; // Disable error section - we'll handle QR generation as loading instead

  // Auto-redirect only after fresh QR scan authentication
  useEffect(() => {
    if (sessionInfo && sessionInfo.name && sessionInfo.name !== "Fetching..." && sessionInfo.name !== "WhatsApp User") {
      // Check if this is a fresh authentication (not an existing session)
      const wasWaitingForQR = !sessionInfo && qrData?.qr;
      const isNewAuth = sessionStorage.getItem(`fresh-auth-redirect-${sessionInfo.name}-${sessionInfo.loginTime}`) !== 'completed';
      
      // Only redirect if we were just waiting for QR scan and this is a new authentication
      if (isNewAuth && (qrData?.qr || wasWaitingForQR)) {
        sessionStorage.setItem(`fresh-auth-redirect-${sessionInfo.name}-${sessionInfo.loginTime}`, 'completed');
        
        toast({
          title: "Connected",
          description: `Welcome back, ${sessionInfo.name}!`,
        });
        
        setTimeout(() => {
          setLocation('/dashboard');
        }, 2000);
      }
    }
  }, [sessionInfo, qrData, setLocation, toast]);

  return (
    <div className="w-full">
      {/* QR Code State - Full Screen */}
      {showQRSection && (
        <div className="flex flex-col items-center justify-center min-h-[80vh] bg-background p-8">
          <div className="text-center">
            <div className="mb-8">
              <div className="bg-white p-8 rounded-2xl shadow-xl inline-block border">
                <img
                  src={qrData.qr && qrData.qr.startsWith('data:') ? qrData.qr : `data:image/png;base64,${qrData.qr}`}
                  alt="QR Code for WhatsApp Authentication"
                  className="w-80 h-80 mx-auto rounded-xl"
                  loading="lazy"
                />
              </div>
              <div className="flex items-center justify-center space-x-2 mt-6">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-lg text-muted-foreground font-medium">QR Code Active</span>
              </div>
            </div>
            
            <h1 className="text-4xl font-bold text-foreground mb-4">Scan QR Code</h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Open WhatsApp on your phone and scan this QR code to connect your account.
            </p>
            
            <div className="flex gap-4 justify-center mb-8">
              <Button size="lg" variant="outline" onClick={onRefreshQR}>
                <RefreshCw className="mr-2 h-5 w-5" />
                Refresh QR Code
              </Button>
            </div>
            

          </div>
        </div>
      )}

      {/* Authenticated State - Full Screen */}
      {showAuthenticatedSection && (
        <div className="flex flex-col items-center justify-center min-h-[80vh] bg-background p-8">
          <div className="text-center max-w-2xl">
            <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="text-green-600 h-12 w-12" />
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-4">Successfully Connected!</h1>
            <p className="text-xl text-muted-foreground mb-8">Your WhatsApp account is now linked and ready for automation.</p>

            {/* Clickable Account Plate with Logout inside */}
            <div 
              className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-lg cursor-pointer hover:shadow-xl transition-all duration-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 mx-auto max-w-md"
              onClick={() => setLocation('/dashboard')}
            >
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {sessionInfo.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {sessionInfo.name}
                  </h3>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Connected: {new Date(sessionInfo.loginTime).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(sessionInfo.loginTime).toLocaleTimeString()}
                  </p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent triggering the parent click
                    onLogout();
                  }}
                  disabled={isLogoutPending}
                  className="hover:bg-red-50 hover:border-red-300 hover:text-red-600"
                >
                  {isLogoutPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Logout"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State - Full Screen */}
      {showLoadingSection && (
        <div className="flex flex-col items-center justify-center min-h-[80vh] bg-background p-8">
          <div className="text-center">
            <Loader2 className="h-20 w-20 animate-spin text-primary mx-auto mb-6" />
            <h1 className="text-4xl font-bold text-foreground mb-4">
              {isLogoutPending ? "Logging out..." : "Connecting..."}
            </h1>
            <p className="text-xl text-muted-foreground">
              {isLogoutPending 
                ? "Please wait while we disconnect your account."
                : "Please wait while we establish connection with WhatsApp Web."
              }
            </p>
          </div>
        </div>
      )}

      {/* QR Generating State - Full Screen */}
      {showQRGeneratingSection && (
        <div className="flex flex-col items-center justify-center min-h-[80vh] bg-background p-8">
          <div className="text-center">
            <div className="mb-8">
              <div className="w-80 h-80 bg-muted/20 rounded-2xl border-2 border-dashed border-muted/50 flex items-center justify-center mx-auto">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
              </div>
              <div className="flex items-center justify-center space-x-2 mt-6">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-lg text-muted-foreground font-medium">QR Code Generating</span>
              </div>
            </div>
            
            <h1 className="text-4xl font-bold text-foreground mb-4">Generating QR Code</h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Please wait while we generate a new QR code for WhatsApp authentication.
            </p>
            
            <div className="flex gap-4 justify-center mb-8">
              <Button size="lg" variant="outline" onClick={onRefreshQR}>
                <RefreshCw className="mr-2 h-5 w-5" />
                Refresh QR Code
              </Button>
            </div>
            

          </div>
        </div>
      )}

      {/* Error State - Full Screen */}
      {showErrorSection && (
        <div className="flex flex-col items-center justify-center min-h-[80vh] bg-background p-8">
          <div className="text-center max-w-2xl">
            <div className="mx-auto w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="text-red-600 h-12 w-12" />
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-4">Connection Failed</h1>
            <p className="text-xl text-muted-foreground mb-8">
              Unable to establish connection with WhatsApp Web. Please try again.
            </p>

            <div className="flex gap-4 justify-center">
              <Button size="lg" onClick={onRetryConnection}>
                <RotateCcw className="mr-2 h-5 w-5" />
                Try Again
              </Button>
              <Button size="lg" variant="outline" onClick={onRefreshQR}>
                <RefreshCw className="mr-2 h-5 w-5" />
                Refresh QR Code
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}