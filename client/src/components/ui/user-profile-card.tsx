import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";

interface UserProfileCardProps {
  user?: {
    name: string;
    loginTime: string;
  };
  isLoading?: boolean;
}

export function UserProfileCard({ user, isLoading = false }: UserProfileCardProps) {
  const formatLoginTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return `Connected: ${date.toLocaleDateString()}, ${date.toLocaleTimeString()}`;
  };

  const getFirstCharacter = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  if (isLoading || !user) {
    return (
      <div className="bg-muted rounded-lg p-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
          <div className="flex-1">
            <div className="h-5 bg-gray-300 rounded animate-pulse mb-2"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted rounded-lg p-6">
      <div className="flex flex-col items-center text-center space-y-4">
        <Avatar className="w-16 h-16 rounded-full">
          <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold rounded-full">
            {getFirstCharacter(user.name)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h5 className="font-semibold text-foreground mb-2">{user.name}</h5>
          <p className="text-sm text-muted-foreground">
            {formatLoginTime(user.loginTime)}
          </p>
        </div>
      </div>
    </div>
  );
}