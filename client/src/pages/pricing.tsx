import { useState } from "react";
import Navigation from "@/components/ui/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { Check, Star, Zap, Crown } from "lucide-react";

export default function Pricing() {
  const [isYearly, setIsYearly] = useState(false);

  const plans = [
    {
      name: "Free",
      description: "Perfect for getting started",
      icon: Zap,
      color: "text-green-600",
      price: { monthly: 0, yearly: 0 },
      features: [
        "Up to 100 messages per month",
        "Basic contact management",
        "Simple message templates",
        "Email support",
        "Basic analytics"
      ],
      limitations: [
        "Limited to 50 contacts",
        "No automation features",
        "Basic reporting only"
      ],
      buttonText: "Get Started Free",
      buttonVariant: "outline" as const,
      popular: false
    },
    {
      name: "Pro",
      description: "For growing businesses",
      icon: Star,
      color: "text-blue-600",
      price: { monthly: 29, yearly: 290 },
      features: [
        "Up to 10,000 messages per month",
        "Advanced contact management",
        "Custom message templates",
        "Scheduled messaging",
        "Advanced analytics & reporting",
        "API access",
        "Priority email support",
        "Message automation"
      ],
      limitations: [
        "Up to 5,000 contacts",
        "Limited integrations"
      ],
      buttonText: "Start Pro Trial",
      buttonVariant: "default" as const,
      popular: true
    },
    {
      name: "Team",
      description: "For large organizations",
      icon: Crown,
      color: "text-purple-600",
      price: { monthly: 99, yearly: 990 },
      features: [
        "Unlimited messages",
        "Unlimited contacts",
        "Team collaboration tools",
        "Advanced automation workflows",
        "Custom integrations",
        "Dedicated account manager",
        "24/7 phone & chat support",
        "Advanced security features",
        "Custom branding",
        "Priority feature requests"
      ],
      limitations: [],
      buttonText: "Contact Sales",
      buttonVariant: "default" as const,
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Navigation currentPage="pricing" />
      
      {/* Hero Section */}
      <section className="pt-32 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 mb-4">
            Simple Pricing
          </Badge>
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Choose the Perfect Plan for
            <span className="text-purple-600 dark:text-purple-400"> Your Business</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
            Scale your WhatsApp marketing with confidence. No hidden fees, no surprises - 
            just transparent pricing that grows with your business.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center space-x-4 mb-12">
            <Label htmlFor="billing-toggle" className="text-gray-600 dark:text-gray-300">
              Monthly
            </Label>
            <Switch
              id="billing-toggle"
              checked={isYearly}
              onCheckedChange={setIsYearly}
            />
            <Label htmlFor="billing-toggle" className="text-gray-600 dark:text-gray-300">
              Yearly
            </Label>
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 ml-2">
              Save 17%
            </Badge>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, index) => {
              const IconComponent = plan.icon;
              const price = isYearly ? plan.price.yearly : plan.price.monthly;
              const priceDisplay = price === 0 ? "Free" : `$${price}`;
              const billingPeriod = isYearly ? "/year" : "/month";
              
              return (
                <Card 
                  key={index} 
                  className={`relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-0 shadow-lg hover:shadow-xl transition-all duration-300 ${
                    plan.popular ? 'scale-105 ring-2 ring-blue-500 ring-opacity-50' : 'hover:scale-105'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-blue-600 text-white px-4 py-1">
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader className="text-center pb-4">
                    <div className="flex items-center justify-center mb-4">
                      <div className={`p-3 rounded-lg bg-gray-100 dark:bg-gray-700 ${plan.color}`}>
                        <IconComponent size={32} />
                      </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                      {plan.name}
                    </CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-300">
                      {plan.description}
                    </CardDescription>
                    <div className="mt-4">
                      <span className="text-4xl font-bold text-gray-900 dark:text-white">
                        {priceDisplay}
                      </span>
                      {price > 0 && (
                        <span className="text-gray-600 dark:text-gray-300 text-lg">
                          {billingPeriod}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      {plan.features.map((feature, featureIndex) => (
                        <div key={featureIndex} className="flex items-start space-x-3">
                          <Check className="text-green-600 dark:text-green-400 w-5 h-5 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-600 dark:text-gray-300 text-sm">
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="pt-6">
                      {plan.name === "Team" ? (
                        <Button 
                          variant={plan.buttonVariant}
                          className={`w-full ${plan.popular ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                        >
                          {plan.buttonText}
                        </Button>
                      ) : (
                        <Link href="/signup">
                          <Button 
                            variant={plan.buttonVariant}
                            className={`w-full ${plan.popular ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                          >
                            {plan.buttonText}
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Can I change my plan anytime?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Yes, you can upgrade or downgrade your plan at any time. Changes will be reflected in your next billing cycle.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Is there a free trial for paid plans?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Yes, we offer a 14-day free trial for our Pro plan. No credit card required to start your trial.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                What happens if I exceed my message limit?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                If you exceed your monthly message limit, you can purchase additional message credits or upgrade to a higher plan.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}