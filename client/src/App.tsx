import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Terms from "@/pages/terms";
import ForgotPassword from "@/pages/forgot-password";
import AccountManagement from "@/pages/account-management";
import Dashboard from "@/pages/dashboard";
import ChatPage from "@/pages/chat";
import GroupContacts from "@/pages/group-contacts";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/terms" component={Terms} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/account" component={AccountManagement} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/chat/:contactId" component={ChatPage} />
      <Route path="/group-contacts/:groupId" component={GroupContacts} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
