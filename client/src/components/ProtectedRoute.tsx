import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";

interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
}

interface AuthResponse {
  authenticated: boolean;
  user: User;
}

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();

  // Check authentication status
  const { data: authData, isLoading, error } = useQuery<AuthResponse>({
    queryKey: ['/api/auth/session'],
    retry: false, // Don't retry on auth failure
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
  });

  useEffect(() => {
    // If not loading and either there's an error or user is not authenticated
    if (!isLoading && (!authData?.authenticated || error)) {
      console.log('🔒 User not authenticated, redirecting to login');
      setLocation('/login');
    }
  }, [authData, isLoading, error, setLocation]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If authenticated, render the protected content
  if (authData?.authenticated) {
    return <>{children}</>;
  }

  // If not authenticated, don't render anything (user will be redirected)
  return null;
}