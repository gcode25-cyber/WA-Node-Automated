import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Eye, EyeOff } from "lucide-react";
import { loginSchema, type LoginRequest } from "@shared/schema";
import Navigation from "@/components/ui/navigation";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    clearErrors,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      usernameOrEmail: "",
      password: "",
      rememberMe: false,
    }
  });

  const fieldValues = watch();

  const loginMutation = useMutation({
    mutationFn: async (data: LoginRequest) => {
      return await apiRequest("/api/auth/login", "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Login successful! Redirecting to dashboard...",
      });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid credentials. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginRequest) => {
    console.log("Login form submitted with data:", data);
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Navigation currentPage="login" />

      <div className="flex items-center justify-center min-h-[calc(100vh-5rem)] px-4">
        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl w-full items-center">
            {/* Left Side - Login Form */}
            <div className="flex items-center justify-center">
              <Card className="w-full max-w-md shadow-2xl border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md">
                <CardHeader className="space-y-4 text-center">
                  <div>
                    <CardTitle className="text-3xl font-bold text-gray-900 dark:text-white font-inter tracking-tight">Login</CardTitle>
                  </div>
                </CardHeader>
              
                <CardContent className="space-y-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="relative">
                  <Input
                    id="usernameOrEmail"
                    type="text"
                    className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 py-3 px-3"
                    {...register("usernameOrEmail")}
                  />
                  <Label 
                    htmlFor="usernameOrEmail" 
                    className={`absolute left-3 pointer-events-none transition-all duration-200 ${
                      fieldValues.usernameOrEmail
                        ? "hidden"
                        : "top-3 text-sm text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    Enter your username or email
                  </Label>
                  {errors.usernameOrEmail && (
                    <p className="text-sm text-red-500 mt-1">{errors.usernameOrEmail.message}</p>
                  )}
                </div>

                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 py-3 px-3 pr-12"
                    {...register("password")}
                  />
                  <Label 
                    htmlFor="password" 
                    className={`absolute left-3 pointer-events-none transition-all duration-200 ${
                      fieldValues.password
                        ? "hidden"
                        : "top-3 text-sm text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    Enter your Password
                  </Label>
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                  {errors.password && (
                    <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="rememberMe"
                      checked={fieldValues.rememberMe}
                      onCheckedChange={(checked) => setValue("rememberMe", checked === true)}
                    />
                    <Label htmlFor="rememberMe" className="text-sm text-gray-600 dark:text-gray-400">
                      Remember me
                    </Label>
                  </div>
                  <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                    Forgot password?
                  </Link>
                </div>

                {loginMutation.isError && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {(loginMutation.error as Error)?.message || "Login failed. Please try again."}
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 text-lg font-semibold font-inter tracking-wide rounded-full transition-all duration-300 hover:scale-105 hover:shadow-lg active:scale-95"
                  disabled={isSubmitting || loginMutation.isPending}
                >
                  {isSubmitting || loginMutation.isPending ? "Logging in..." : "LOGIN"}
                </Button>
              </form>

              <div className="text-center">
                <span className="text-gray-600 dark:text-gray-400">Don't have an account? </span>
                <Link href="/signup" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
                  Sign up
                </Link>
              </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Side - Animated Illustration */}
            <div className="hidden lg:flex items-center justify-center relative">
              <div className="relative">
                {/* Animated image */}
                <img 
                  src="/form-user.png"
                  alt="WhatsApp Messaging Illustration"
                  className="w-96 h-96 object-contain transform hover:scale-110 transition-all duration-700 hover:rotate-3 filter drop-shadow-2xl"
                  loading="lazy"
                />
                
                {/* Floating animated elements */}
                <div className="absolute -top-4 -right-4 w-16 h-16 bg-pink-500 rounded-full opacity-20 animate-pulse"></div>
                <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-purple-500 rounded-full opacity-20 animate-pulse"></div>
                <div className="absolute top-1/2 -left-8 w-12 h-12 bg-blue-400 rounded-full opacity-30 animate-bounce"></div>
              </div>
            </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-center">
        <div className="flex space-x-6 text-sm text-gray-600 dark:text-gray-400">
          <Link href="#" className="hover:text-gray-900 dark:hover:text-white">Terms of Service</Link>
          <Link href="#" className="hover:text-gray-900 dark:hover:text-white">Privacy Policy</Link>
        </div>
      </div>
    </div>
  );
}