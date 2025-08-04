import Navigation from "@/components/ui/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Calendar, Clock, ArrowRight, TrendingUp, Users, Zap } from "lucide-react";

export default function Blogs() {
  const featuredPost = {
    title: "How HubWale Helped TechCorp Increase Customer Engagement by 300%",
    excerpt: "Discover how one of our enterprise clients transformed their customer communication strategy using HubWale's advanced WhatsApp automation features.",
    category: "Success Story",
    readTime: "8 min read",
    date: "December 15, 2024",
    image: "https://images.unsplash.com/photo-1553028826-f4804a6dba3b?w=600&h=400&fit=crop&crop=center",
    featured: true
  };

  const blogPosts = [
    {
      title: "The Future of WhatsApp Business: 2025 Trends and Predictions",
      excerpt: "Explore the upcoming trends in WhatsApp business communication and how to prepare your strategy for the next year.",
      category: "Future Plans",
      readTime: "6 min read",
      date: "December 10, 2024",
      image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=250&fit=crop&crop=center"
    },
    {
      title: "10 WhatsApp Marketing Strategies That Actually Work",
      excerpt: "Learn proven strategies to boost your WhatsApp marketing campaigns and drive better engagement rates.",
      category: "Marketing Tips",
      readTime: "12 min read",
      date: "December 5, 2024",
      image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=400&h=250&fit=crop&crop=center"
    },
    {
      title: "From Startup to Scale: Our Journey Building HubWale",
      excerpt: "The inside story of how we built HubWale from a simple idea to a comprehensive WhatsApp automation platform.",
      category: "Company Story",
      readTime: "10 min read",
      date: "November 28, 2024",
      image: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=400&h=250&fit=crop&crop=center"
    },
    {
      title: "Customer Success: E-commerce Store Boosts Sales by 250%",
      excerpt: "How an online retailer used HubWale's automation features to create personalized shopping experiences through WhatsApp.",
      category: "Success Story",
      readTime: "7 min read",
      date: "November 20, 2024",
      image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=250&fit=crop&crop=center"
    },
    {
      title: "Security First: How We Protect Your WhatsApp Data",
      excerpt: "An in-depth look at our security measures and commitment to protecting your business communications.",
      category: "Technology",
      readTime: "9 min read",
      date: "November 15, 2024",
      image: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400&h=250&fit=crop&crop=center"
    },
    {
      title: "Roadmap 2025: Exciting New Features Coming to HubWale",
      excerpt: "Get a sneak peek at the innovative features and improvements we're planning for the next year.",
      category: "Future Plans",
      readTime: "5 min read",
      date: "November 10, 2024",
      image: "https://images.unsplash.com/photo-1517077304055-6e89abbf09b0?w=400&h=250&fit=crop&crop=center"
    }
  ];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Success Story":
        return TrendingUp;
      case "Future Plans":
        return Zap;
      case "Marketing Tips":
        return Users;
      default:
        return Calendar;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Success Story":
        return "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400";
      case "Future Plans":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400";
      case "Marketing Tips":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Navigation currentPage="blogs" />
      
      {/* Hero Section */}
      <section className="pt-32 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 mb-4">
            Our Blog
          </Badge>
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Stories, Tips, and Insights from
            <span className="text-orange-600 dark:text-orange-400"> HubWale</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
            Stay updated with the latest trends in WhatsApp marketing, success stories from our customers, 
            and insights into the future of business communication.
          </p>
        </div>
      </section>

      {/* Featured Post */}
      <section className="pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-0 shadow-xl overflow-hidden">
            <div className="grid lg:grid-cols-2 gap-0">
              <div className="aspect-video lg:aspect-auto">
                <img 
                  src={featuredPost.image} 
                  alt={featuredPost.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-8 lg:p-12 flex flex-col justify-center">
                <div className="flex items-center space-x-4 mb-4">
                  <Badge className={getCategoryColor(featuredPost.category)}>
                    {featuredPost.category}
                  </Badge>
                  <Badge variant="outline">Featured</Badge>
                </div>
                <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
                  {featuredPost.title}
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                  {featuredPost.excerpt}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-1">
                      <Calendar size={14} />
                      <span>{featuredPost.date}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock size={14} />
                      <span>{featuredPost.readTime}</span>
                    </div>
                  </div>
                  <Button className="bg-orange-600 hover:bg-orange-700 text-white">
                    Read More <ArrowRight size={16} className="ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Blog Grid */}
      <section className="pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-12">
            Latest Articles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.map((post, index) => {
              const IconComponent = getCategoryIcon(post.category);
              return (
                <Card key={index} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 overflow-hidden">
                  <div className="aspect-video overflow-hidden">
                    <img 
                      src={post.image} 
                      alt={post.title}
                      className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-2 mb-3">
                      <Badge className={getCategoryColor(post.category)}>
                        <IconComponent size={12} className="mr-1" />
                        {post.category}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white leading-tight">
                      {post.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                      {post.excerpt}
                    </CardDescription>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center space-x-1">
                          <Calendar size={12} />
                          <span>{post.date}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock size={12} />
                          <span>{post.readTime}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-orange-600 hover:text-orange-700 p-0">
                        Read <ArrowRight size={14} className="ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-16 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Stay Updated with HubWale
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            Get the latest insights, tips, and updates delivered straight to your inbox.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
            <input 
              type="email" 
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <Button className="bg-orange-600 hover:bg-orange-700 text-white px-6">
              Subscribe
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}