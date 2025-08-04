import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    if (!email.includes("@")) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setIsSubmitted(true);
      toast({
        title: "Reset Link Sent",
        description: "Check your email for password reset instructions",
      });
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header with Logo */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <Link href="/">
            <img src="/hw-logo.png" alt="HubWale" className="h-8 w-auto cursor-pointer" loading="lazy" />
          </Link>
          <Link href="/login">
            <Button variant="ghost" className="flex items-center space-x-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Login</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center px-4">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              {isSubmitted ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : (
                <Mail className="h-6 w-6 text-primary" />
              )}
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white font-inter tracking-tight">
                {isSubmitted ? "Check Your Email" : "Forgot Password"}
              </CardTitle>
              <CardDescription className="mt-2">
                {isSubmitted 
                  ? "We've sent password reset instructions to your email address"
                  : "Enter your email address and we'll send you a link to reset your password"
                }
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent>
            {isSubmitted ? (
              <div className="space-y-4">
                <div className="text-center space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Didn't receive the email? Check your spam folder or try again.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsSubmitted(false);
                      setEmail("");
                    }}
                    className="w-full"
                  >
                    Try Different Email
                  </Button>
                </div>
                <div className="text-center">
                  <Link href="/login">
                    <Button variant="ghost" className="text-sm">
                      Back to Login
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 py-3 px-3"
                    disabled={isLoading}
                  />
                  <Label 
                    htmlFor="email" 
                    className={`absolute left-3 pointer-events-none transition-all duration-200 ${
                      email
                        ? "hidden"
                        : "top-3 text-sm text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    Enter your email address
                  </Label>
                </div>

                <Button 
                  type="submit" 
                  className="w-full py-3" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Sending Reset Link...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>

                <div className="text-center">
                  <Link href="/login">
                    <Button variant="ghost" className="text-sm">
                      Remember your password? Sign in
                    </Button>
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}