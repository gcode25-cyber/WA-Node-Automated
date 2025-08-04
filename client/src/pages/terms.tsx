import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function Terms() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header with Logo */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <Link href="/">
            <img src="/hw-logo.png" alt="HubWale" className="h-8 w-auto cursor-pointer" loading="lazy" />
          </Link>
          <Link href="/signup">
            <Button variant="ghost" className="flex items-center space-x-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Signup</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Terms Content */}
      <div className="container mx-auto px-4 pb-12">
        <div className="max-w-4xl mx-auto">
          <Card className="shadow-2xl border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md">
            <CardHeader className="text-center space-y-4">
              <CardTitle className="text-3xl font-bold text-gray-900 dark:text-white font-inter tracking-tight">
                Terms and Conditions
              </CardTitle>
              <p className="text-gray-600 dark:text-gray-400">
                Last updated: {new Date().toLocaleDateString()}
              </p>
            </CardHeader>
            
            <CardContent className="space-y-6 text-gray-700 dark:text-gray-300">
              <section>
                <h2 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">1. Acceptance of Terms</h2>
                <p>
                  By accessing and using HubWale's WhatsApp bulk messaging platform, you accept and agree to be bound by the terms and provision of this agreement.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">2. Service Description</h2>
                <p>
                  HubWale provides a WhatsApp Web integration platform that allows users to send bulk messages, manage contacts, and organize messaging campaigns. Our service is built for legitimate business communication purposes.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">3. WhatsApp Compliance</h2>
                <div className="space-y-2">
                  <p><strong>Important Notice:</strong> This service uses WhatsApp Web API, and users must comply with WhatsApp's Terms of Service:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Only send messages to users who have explicitly opted in</li>
                    <li>Respect WhatsApp's anti-spam policies</li>
                    <li>Do not use this service for unsolicited marketing</li>
                    <li>Account suspension risk exists when using unofficial APIs</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">4. User Responsibilities</h2>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>You are responsible for all content sent through our platform</li>
                  <li>You must obtain proper consent before messaging recipients</li>
                  <li>You agree not to use the service for illegal or harmful purposes</li>
                  <li>You must protect your account credentials</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">5. Privacy and Data Protection</h2>
                <p>
                  We respect your privacy and protect your data according to applicable data protection laws. Contact information and messages are stored securely and used only for service functionality.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">6. Service Availability</h2>
                <p>
                  While we strive for 100% uptime, we cannot guarantee uninterrupted service. WhatsApp Web connectivity depends on external factors beyond our control.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">7. Limitation of Liability</h2>
                <p>
                  HubWale shall not be liable for any direct, indirect, incidental, special, or consequential damages resulting from the use or inability to use our service.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">8. Account Termination</h2>
                <p>
                  We reserve the right to terminate accounts that violate these terms, engage in spam, or misuse our platform.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">9. Changes to Terms</h2>
                <p>
                  We may update these terms periodically. Continued use of the service after changes constitutes acceptance of the new terms.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">10. Contact Information</h2>
                <p>
                  If you have any questions about these Terms and Conditions, please contact us through our support channel.
                </p>
              </section>

              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  By creating an account, you acknowledge that you have read, understood, and agree to these Terms and Conditions.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}