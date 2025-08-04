import Navigation from "@/components/ui/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  MessageSquare, 
  Users, 
  BarChart3, 
  Shield, 
  Zap, 
  Clock,
  Target,
  Globe,
  Smartphone,
  Database,
  Settings,
  HeadphonesIcon
} from "lucide-react";

export default function Features() {
  const features = [
    {
      icon: MessageSquare,
      title: "Bulk WhatsApp Messaging",
      description: "Send personalized messages to thousands of contacts instantly with our advanced bulk messaging system.",
      color: "text-blue-600"
    },
    {
      icon: Users,
      title: "Contact Management",
      description: "Organize and manage your contacts with smart grouping, tagging, and filtering capabilities.",
      color: "text-green-600"
    },
    {
      icon: BarChart3,
      title: "Analytics & Reporting",
      description: "Track message delivery rates, engagement metrics, and campaign performance with detailed analytics.",
      color: "text-purple-600"
    },
    {
      icon: Shield,
      title: "Privacy & Security",
      description: "Enterprise-grade security with end-to-end encryption and compliance with data protection regulations.",
      color: "text-red-600"
    },
    {
      icon: Zap,
      title: "Automation",
      description: "Set up automated workflows, scheduled messages, and smart responses to save time and effort.",
      color: "text-yellow-600"
    },
    {
      icon: Clock,
      title: "Schedule Messages",
      description: "Plan and schedule your messages for optimal timing across different time zones.",
      color: "text-indigo-600"
    },
    {
      icon: Target,
      title: "Targeted Campaigns",
      description: "Create targeted marketing campaigns with advanced segmentation and personalization options.",
      color: "text-pink-600"
    },
    {
      icon: Globe,
      title: "Multi-Language Support",
      description: "Communicate with your global audience using our built-in translation and localization features.",
      color: "text-orange-600"
    },
    {
      icon: Smartphone,
      title: "Mobile Optimized",
      description: "Access all features seamlessly across desktop, tablet, and mobile devices with our responsive design.",
      color: "text-teal-600"
    },
    {
      icon: Database,
      title: "Data Import/Export",
      description: "Easily import contacts from CSV, Excel, or integrate with your existing CRM systems.",
      color: "text-cyan-600"
    },
    {
      icon: Settings,
      title: "Custom Integrations",
      description: "Connect with your favorite tools and platforms through our robust API and webhook system.",
      color: "text-gray-600"
    },
    {
      icon: HeadphonesIcon,
      title: "24/7 Support",
      description: "Get expert help whenever you need it with our dedicated customer support team.",
      color: "text-emerald-600"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Navigation currentPage="features" />
      
      {/* Hero Section */}
      <section className="pt-32 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 mb-4">
            Powerful Features
          </Badge>
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Everything You Need for
            <span className="text-blue-600 dark:text-blue-400"> WhatsApp Marketing</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
            Discover the comprehensive suite of tools and features that make HubWale the ultimate 
            WhatsApp automation platform for businesses of all sizes.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <Card key={index} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-700 ${feature.color}`}>
                        <IconComponent size={24} />
                      </div>
                      <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                        {feature.title}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-gray-600 dark:text-gray-300 leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Ready to Transform Your WhatsApp Marketing?
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            Join thousands of businesses who trust HubWale for their WhatsApp automation needs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3">
                Get Started Free
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="border-gray-300 dark:border-gray-600 px-8 py-3">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}