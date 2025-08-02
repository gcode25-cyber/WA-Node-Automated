import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, AlertTriangle } from "lucide-react";

interface StatusBannerProps {
  type: "success" | "warning" | "error";
  message: string;
}

export function StatusBanner({ type, message }: StatusBannerProps) {
  const icons = {
    success: CheckCircle,
    warning: AlertTriangle,
    error: AlertCircle,
  };

  const styles = {
    success: "bg-green-50 border-green-200 text-green-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    error: "bg-red-50 border-red-200 text-red-800",
  };

  const Icon = icons[type];

  return (
    <Alert className={`mb-6 animate-in slide-in-from-top-5 ${styles[type]}`}>
      <Icon className="h-4 w-4" />
      <AlertDescription className="font-medium">
        {message}
      </AlertDescription>
    </Alert>
  );
}
