import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Auth from "@/pages/Auth";
import NotFound from "./pages/NotFound";
import LoanOfficer from "@/pages/LoanOfficer";
import MasterRoll from "@/pages/MasterRoll";
import Groups from "@/pages/Groups";
import Members from "@/pages/Members";
import SearchMember from "@/pages/SearchMember";
import LoanAccounts from "@/pages/LoanAccounts";
import DailyOverdue from "@/pages/DailyOverdue";
import RealizableReport from "@/pages/RealizableReport";
import DormantMembers from "@/pages/DormantMembers";
import BadDebt from "@/pages/BadDebt";
import Profile from "@/pages/Profile";
import Settings from "@/pages/Settings";
import Users from "@/pages/Users";
import Security from "@/pages/Security";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="loan-officer" element={<LoanOfficer />} />
              <Route path="master-roll" element={<MasterRoll />} />
              <Route path="groups" element={<Groups />} />
              <Route path="members" element={<Members />} />
              <Route path="search-member" element={<SearchMember />} />
              <Route path="loan-accounts" element={<LoanAccounts />} />
              <Route path="daily-overdue" element={<DailyOverdue />} />
              <Route path="realizable-report" element={<RealizableReport />} />
              <Route path="dormant-members" element={<DormantMembers />} />
              <Route path="bad-debt" element={<BadDebt />} />
              <Route path="profile" element={<Profile />} />
              <Route path="settings" element={<Settings />} />
              <Route path="users" element={<Users />} />
              <Route path="security" element={<Security />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
