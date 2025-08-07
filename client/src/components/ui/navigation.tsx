import React from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";

interface NavigationProps {
  showAuthButtons?: boolean;
  currentPage?: 'home' | 'login' | 'signup' | 'features' | 'pricing' | 'blogs';
}

const Navigation: React.FC<NavigationProps> = ({ showAuthButtons = true, currentPage }) => {
  const [location] = useLocation();

  const isCurrentPage = (page: string) => {
    if (currentPage) return currentPage === page;
    return location === `/${page}` || (page === 'home' && location === '/');
  };

  const linkClass = (page: string) => {
    return isCurrentPage(page) 
      ? "text-gray-400 dark:text-gray-500 cursor-not-allowed transition-colors"
      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer";
  };

  const NavLink = ({ href, page, children }: { href: string; page: string; children: React.ReactNode }) => {
    if (isCurrentPage(page)) {
      return <span className={linkClass(page)}>{children}</span>;
    }
    return <Link href={href} className={linkClass(page)}>{children}</Link>;
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <Link href="/">
              <img src="/hw-logo.png" alt="HubWale" className="h-8 w-auto cursor-pointer" loading="lazy" />
            </Link>
          </div>
          
          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <NavLink href="/" page="home">Home</NavLink>
            <NavLink href="/features" page="features">Features</NavLink>
            <NavLink href="/pricing" page="pricing">Pricing</NavLink>
            <NavLink href="/blogs" page="blogs">Blogs</NavLink>
          </div>
          
          {/* Auth Buttons */}
          {showAuthButtons && (
            <div className="flex items-center space-x-4">
              {isCurrentPage('login') ? (
                <Button 
                  variant="ghost" 
                  className="text-gray-400 dark:text-gray-500 cursor-not-allowed"
                  disabled
                >
                  Login
                </Button>
              ) : (
                <Link href="/login">
                  <Button variant="ghost" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                    Login
                  </Button>
                </Link>
              )}
              
              {isCurrentPage('signup') ? (
                <Button 
                  className="bg-gray-400 hover:bg-gray-400 text-white shadow-lg cursor-not-allowed"
                  disabled
                >
                  Sign up
                </Button>
              ) : (
                <Link href="/signup">
                  <Button className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg">
                    Sign up
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;