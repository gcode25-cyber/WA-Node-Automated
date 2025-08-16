import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Eye, EyeOff } from "lucide-react";
import { type SignupRequest } from "@shared/schema";
import Navigation from "@/components/ui/navigation";

// Country codes list with phone number validation
const countryCodes = [
  { code: "+91", country: "India", flag: "🇮🇳", id: "in", digits: { min: 10, max: 10 } },
  { code: "+1", country: "USA", flag: "🇺🇸", id: "us", digits: { min: 10, max: 10 } },
  { code: "+1", country: "Canada", flag: "🇨🇦", id: "ca", digits: { min: 10, max: 10 } },
  { code: "+44", country: "United Kingdom", flag: "🇬🇧", id: "gb", digits: { min: 10, max: 11 } },
  { code: "+49", country: "Germany", flag: "🇩🇪", id: "de", digits: { min: 10, max: 11 } },
  { code: "+33", country: "France", flag: "🇫🇷", id: "fr", digits: { min: 9, max: 9 } },
  { code: "+61", country: "Australia", flag: "🇦🇺", id: "au", digits: { min: 9, max: 9 } },
  { code: "+55", country: "Brazil", flag: "🇧🇷", id: "br", digits: { min: 10, max: 11 } },
  { code: "+86", country: "China", flag: "🇨🇳", id: "cn", digits: { min: 11, max: 11 } },
  { code: "+81", country: "Japan", flag: "🇯🇵", id: "jp", digits: { min: 10, max: 11 } },
  { code: "+82", country: "South Korea", flag: "🇰🇷", id: "kr", digits: { min: 9, max: 10 } },
  { code: "+7", country: "Russia", flag: "🇷🇺", id: "ru", digits: { min: 10, max: 10 } },
  { code: "+52", country: "Mexico", flag: "🇲🇽", id: "mx", digits: { min: 10, max: 10 } },
  { code: "+62", country: "Indonesia", flag: "🇮🇩", id: "id", digits: { min: 10, max: 12 } },
  { code: "+92", country: "Pakistan", flag: "🇵🇰", id: "pk", digits: { min: 10, max: 10 } },
  { code: "+880", country: "Bangladesh", flag: "🇧🇩", id: "bd", digits: { min: 10, max: 10 } },
  { code: "+234", country: "Nigeria", flag: "🇳🇬", id: "ng", digits: { min: 10, max: 10 } },
  { code: "+27", country: "South Africa", flag: "🇿🇦", id: "za", digits: { min: 9, max: 9 } },
  { code: "+90", country: "Turkey", flag: "🇹🇷", id: "tr", digits: { min: 10, max: 10 } },
  { code: "+20", country: "Egypt", flag: "🇪🇬", id: "eg", digits: { min: 10, max: 10 } },
  { code: "+63", country: "Philippines", flag: "🇵🇭", id: "ph", digits: { min: 10, max: 10 } },
  { code: "+54", country: "Argentina", flag: "🇦🇷", id: "ar", digits: { min: 10, max: 11 } },
  { code: "+60", country: "Malaysia", flag: "🇲🇾", id: "my", digits: { min: 9, max: 10 } },
  { code: "+84", country: "Vietnam", flag: "🇻🇳", id: "vn", digits: { min: 9, max: 10 } },
  { code: "+66", country: "Thailand", flag: "🇹🇭", id: "th", digits: { min: 9, max: 9 } },
  { code: "+971", country: "United Arab Emirates", flag: "🇦🇪", id: "ae", digits: { min: 9, max: 9 } },
];

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedCountryCode, setSelectedCountryCode] = useState("+91");

  const {
    register,
    handleSubmit,
    watch,
    clearErrors,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<SignupRequest>({
    mode: "onBlur",
    defaultValues: {
      fullName: "",
      username: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    }
  });

  const fieldValues = watch();

  // Re-validate phone when country changes
  useEffect(() => {
    if (fieldValues.phone) {
      clearErrors("phone");
      // Trigger re-validation
      setValue("phone", fieldValues.phone, { shouldValidate: true });
    }
  }, [selectedCountryCode, fieldValues.phone, clearErrors, setValue]);

  // Get current country's digit requirements
  const getCurrentCountryDigits = () => {
    const country = countryCodes.find(c => c.code === selectedCountryCode);
    return country ? country.digits : { min: 10, max: 10 };
  };

  const getPlaceholderText = () => {
    const digits = getCurrentCountryDigits();
    if (digits.min === digits.max) {
      return `Enter ${digits.min} digit phone number`;
    }
    return `Enter ${digits.min}-${digits.max} digit phone number`;
  };

  // Custom phone validation
  const validatePhoneNumber = (phone: string) => {
    if (!phone || phone.trim() === "") {
      return "Phone number is required";
    }
    
    const digits = getCurrentCountryDigits();
    const phoneDigits = phone.replace(/\D/g, '').length;
    
    if (phoneDigits < digits.min) {
      return `Phone number must be at least ${digits.min} digits for ${countryCodes.find(c => c.code === selectedCountryCode)?.country}`;
    }
    if (phoneDigits > digits.max) {
      return `Phone number must not exceed ${digits.max} digits for ${countryCodes.find(c => c.code === selectedCountryCode)?.country}`;
    }
    
    return true;
  };

  const signupMutation = useMutation({
    mutationFn: async (data: SignupRequest) => {
      return await apiRequest("/api/auth/signup", "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Account created successfully! Redirecting to dashboard...",
      });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Signup Failed",
        description: error.message || "Failed to create account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SignupRequest) => {
    // Combine country code with phone number
    const formattedData = {
      ...data,
      phone: selectedCountryCode + data.phone
    };
    console.log("Signup form submitted with data:", formattedData);
    signupMutation.mutate(formattedData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Navigation currentPage="signup" />

      <div className="flex items-center justify-center min-h-screen pt-24 pb-8 px-4">
        <div className="grid lg:grid-cols-2 gap-4 lg:gap-8 max-w-6xl w-full items-center">
            {/* Left Side - Signup Form */}
            <div className="flex items-center justify-center order-2 lg:order-1">
              <Card className="w-full max-w-md shadow-2xl border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md">
                <CardHeader className="space-y-4 text-center">
                  <div>
                    <CardTitle className="text-3xl font-bold text-gray-900 dark:text-white font-inter tracking-tight">Signup</CardTitle>
                  </div>
                </CardHeader>
              
                <CardContent className="space-y-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="relative">
                  <Input
                    id="fullName"
                    type="text"
                    className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 py-3 px-3"
                    {...register("fullName", {
                      required: "Full name is required"
                    })}
                  />
                  <Label 
                    htmlFor="fullName" 
                    className={`absolute left-3 pointer-events-none transition-all duration-200 ${
                      fieldValues.fullName
                        ? "hidden"
                        : "top-3 text-sm text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    Fullname
                  </Label>
                  {errors.fullName && (
                    <p className="text-sm text-red-500 mt-1">{errors.fullName.message}</p>
                  )}
                </div>

                <div className="relative">
                  <Input
                    id="username"
                    type="text"
                    className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 py-3 px-3"
                    {...register("username", {
                      required: "Username is required"
                    })}
                  />
                  <Label 
                    htmlFor="username" 
                    className={`absolute left-3 pointer-events-none transition-all duration-200 ${
                      fieldValues.username
                        ? "hidden"
                        : "top-3 text-sm text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    Username
                  </Label>
                  {errors.username && (
                    <p className="text-sm text-red-500 mt-1">{errors.username.message}</p>
                  )}
                </div>

                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 py-3 px-3"
                    {...register("email", {
                      required: "Email is required",
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: "Invalid email format"
                      }
                    })}
                  />
                  <Label 
                    htmlFor="email" 
                    className={`absolute left-3 pointer-events-none transition-all duration-200 ${
                      fieldValues.email
                        ? "hidden"
                        : "top-3 text-sm text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    Email
                  </Label>
                  {errors.email && (
                    <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex space-x-2">
                    <Select value={selectedCountryCode} onValueChange={setSelectedCountryCode}>
                      <SelectTrigger className="w-32 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {countryCodes.map((country) => (
                          <SelectItem key={country.id} value={country.code}>
                            <div className="flex items-center space-x-2">
                              <span>{country.flag}</span>
                              <span>{country.code}</span>
                              <span className="text-xs text-gray-500">{country.country}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex-1 relative">
                      <Input
                        id="phone"
                        type="tel"
                        className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 py-3 px-3"
                        {...register("phone", {
                          validate: (value) => validatePhoneNumber(value),
                          required: "Phone number is required"
                        })}
                        maxLength={getCurrentCountryDigits().max}
                        onInput={(e) => {
                          const target = e.target as HTMLInputElement;
                          const numericValue = target.value.replace(/[^0-9]/g, '');
                          const maxDigits = getCurrentCountryDigits().max;
                          
                          // Limit to maximum digits for selected country
                          if (numericValue.length > maxDigits) {
                            target.value = numericValue.slice(0, maxDigits);
                          } else {
                            target.value = numericValue;
                          }
                        }}
                        inputMode="numeric"
                        pattern="[0-9]*"
                      />
                      <Label 
                        htmlFor="phone" 
                        className={`absolute left-3 pointer-events-none transition-all duration-200 ${
                          fieldValues.phone
                            ? "hidden"
                            : "top-3 text-sm text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {getPlaceholderText()}
                      </Label>
                    </div>
                  </div>
                  {errors.phone && (
                    <p className="text-sm text-red-500 mt-1">{errors.phone.message}</p>
                  )}
                </div>



                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 py-2 sm:py-3 px-3 pr-12 text-sm sm:text-base"
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
                    Password
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

                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 py-2 sm:py-3 px-3 pr-12 text-sm sm:text-base"
                    {...register("confirmPassword")}
                  />
                  <Label 
                    htmlFor="confirmPassword" 
                    className={`absolute left-3 pointer-events-none transition-all duration-200 ${
                      fieldValues.confirmPassword
                        ? "hidden"
                        : "top-3 text-sm text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    Confirm Password
                  </Label>
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-500 mt-1">{errors.confirmPassword.message}</p>
                  )}
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox 
                    id="acceptTerms"
                    checked={fieldValues.acceptTerms}
                    {...register("acceptTerms", {
                      validate: (value) => value === true || "You must accept the terms and conditions"
                    })}
                    onCheckedChange={(checked) => {
                      setValue("acceptTerms", checked === true, { shouldValidate: true });
                      if (checked && errors.acceptTerms) {
                        clearErrors("acceptTerms");
                      }
                    }}
                    className="mt-1"
                  />
                  <Label htmlFor="acceptTerms" className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    Accept <Link href="/terms" className="text-blue-600 hover:text-blue-800 underline">Terms & Conditions</Link>
                  </Label>
                </div>
                {errors.acceptTerms && (
                  <p className="text-sm text-red-500">{errors.acceptTerms.message}</p>
                )}

                {signupMutation.isError && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {(signupMutation.error as Error)?.message || "Signup failed. Please try again."}
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 text-lg font-semibold font-inter tracking-wide rounded-full transition-all duration-300 hover:scale-105 hover:shadow-lg active:scale-95"
                  disabled={isSubmitting || signupMutation.isPending}
                >
                  {isSubmitting || signupMutation.isPending ? "Creating Account..." : "SIGN UP"}
                </Button>
              </form>

              <div className="text-center">
                <span className="text-gray-600 dark:text-gray-400">Already have an account? </span>
                <Link href="/login" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
                  Login
                </Link>
              </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Side - Animated Illustration */}
            <div className="hidden lg:flex items-center justify-center relative order-1 lg:order-2">
              <div className="relative">
                {/* Animated image */}
                <img 
                  src="/form-user.png"
                  alt="WhatsApp Messaging Illustration"
                  className="w-80 xl:w-96 h-80 xl:h-96 object-contain transform hover:scale-110 transition-all duration-700 hover:-rotate-3 filter drop-shadow-2xl"
                  loading="lazy"
                />
                
                {/* Floating animated elements */}
                <div className="absolute -top-4 -left-4 w-16 h-16 bg-blue-500 rounded-full opacity-20 animate-pulse"></div>
                <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-green-500 rounded-full opacity-20 animate-pulse"></div>
              </div>
            </div>
        </div>
      </div>

      {/* Footer */}
      <div className="py-4 text-center">
        <div className="flex justify-center space-x-4 sm:space-x-6 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          <Link href="#" className="hover:text-gray-900 dark:hover:text-white transition-colors">Terms of Service</Link>
          <Link href="#" className="hover:text-gray-900 dark:hover:text-white transition-colors">Privacy Policy</Link>
        </div>
      </div>
    </div>
  );
}