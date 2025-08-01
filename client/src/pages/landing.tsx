import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import hubwaleLogo from "@assets/hw_logo_1754050125326.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <img src={hubwaleLogo} alt="HubWale" className="h-8 w-auto" />
            </div>
            
            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-8">
              <Link href="#" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                Home
              </Link>
              <Link href="#features" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                Features
              </Link>
              <Link href="#pricing" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                Pricing
              </Link>
              <Link href="#blogs" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                Blogs
              </Link>
            </div>
            
            {/* Auth Buttons */}
            <div className="flex items-center space-x-4">
              <Link href="/login">
                <Button variant="ghost" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                  Login
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg">
                  Sign up
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400">
                  WhatsApp Automation Platform
                </Badge>
                <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                  <span className="text-blue-600 dark:text-blue-400">Your words,</span>{" "}
                  <span className="text-pink-500 dark:text-pink-400">effortlessly</span>
                  <br />
                  <span className="text-gray-900 dark:text-white">delivered.</span>{" "}
                  <span className="text-blue-600 dark:text-blue-400">That's</span>
                  <br />
                  <span className="text-purple-600 dark:text-purple-400">smooth messaging.</span>
                </h1>
                <p className="text-xl text-gray-600 dark:text-gray-300 leading-relaxed">
                  We help you automate WhatsApp messages like a boss, manage contacts like a genius, 
                  and optimize your communication like you've got a degree in viral engagement!
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/signup">
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg">
                    Learn more
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="border-gray-300 dark:border-gray-600 px-8 py-3 text-lg">
                    Get start now
                  </Button>
                </Link>
              </div>

              <div className="text-sm text-gray-500 dark:text-gray-400">
                ⚡ No credit card required
              </div>
            </div>

            {/* Right Content - Animated Hero Image */}
            <div className="relative flex items-center justify-center">
              {/* Animated image */}
              <img 
                src="/attached_assets/image_1754117706199.png"
                alt="WhatsApp Automation Success Illustration"
                className="w-96 h-96 lg:w-[500px] lg:h-[500px] object-contain transform hover:scale-110 transition-all duration-700 hover:rotate-2 filter drop-shadow-2xl"
              />
              
              {/* Floating animated elements */}
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-pink-500 rounded-full opacity-20 animate-pulse"></div>
              <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-purple-500 rounded-full opacity-20 animate-pulse"></div>
              <div className="absolute top-1/2 -right-8 w-12 h-12 bg-blue-500 rounded-full opacity-30 animate-bounce"></div>
              <div className="absolute bottom-1/4 -left-8 w-10 h-10 bg-orange-400 rounded-full opacity-25 animate-pulse"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="space-y-2">
              <div className="text-4xl font-bold text-orange-600 dark:text-orange-400">292</div>
              <div className="text-gray-600 dark:text-gray-400">Total WhatsApp Campaigns completed per month</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-bold text-orange-600 dark:text-orange-400">2,582</div>
              <div className="text-gray-600 dark:text-gray-400">Messages are sent without interruption every week</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-bold text-orange-600 dark:text-orange-400">25,792</div>
              <div className="text-gray-600 dark:text-gray-400">Clients choose platform to build business through WhatsApp</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Tagline */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-4">
            <span className="italic text-gray-700 dark:text-gray-300">Utilize one app to </span>
            <span className="text-blue-600 dark:text-blue-400 italic">Achieve </span>
            <span className="text-gray-700 dark:text-gray-300 italic">multiple </span>
            <span className="text-blue-600 dark:text-blue-400 italic">Goals</span>
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            💡 Maximize efficiency with our automation features, and measure the success of your strategy using real-time analytics and insights 💡
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <img src={hubwaleLogo} alt="HubWale" className="h-6 w-auto" />
            </div>
            <div className="flex space-x-6 text-sm text-gray-600 dark:text-gray-400">
              <Link href="#" className="hover:text-gray-900 dark:hover:text-white">Terms of Service</Link>
              <Link href="#" className="hover:text-gray-900 dark:hover:text-white">Privacy Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}