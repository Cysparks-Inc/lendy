import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import AppLayout from "@/components/AppLayout"; // Using your original path

// --- Using all your original page component imports ---
import Dashboard from "@/pages/Dashboard";
import Auth from "@/pages/Auth";
import NotFound from "./pages/NotFound";
import LoanOfficer from "@/pages/LoanOfficer";
import LoanOfficerProfilePage from './pages/LoanOfficerProfilePage';
import Groups from "@/pages/Groups";
import GroupDetails from "@/pages/GroupDetails";
import GroupEdit from "@/pages/GroupEdit";
import GroupMembers from "@/pages/GroupMembers";
import BulkPayment from "@/pages/BulkPayment";
import Members from "@/pages/MembersPage";
import MemberFormPage from './pages/MemberFormPage';
import MemberProfilePage from './pages/MemberProfilePage';
import SearchMember from "@/pages/SearchMember";
import LoanAccounts from "@/pages/LoansPage"; // Kept your original name
import LoanFormPage from './pages/LoanFormPage';
import LoanDetailsPage from './pages/LoanDetailsPage';
import DailyOverdue from "@/pages/DailyOverdue";
import RealizableReport from "@/pages/RealizableReport";
import AssetFormPage from './pages/AssetFormPage';
import DormantMembers from "@/pages/DormantMembers";
import BadDebt from "@/pages/BadDebt";
import Profile from "@/pages/Profile";
import Settings from "@/pages/Settings";
import Users from "@/pages/UsersPage"; // Kept your original name
import UserFormPage from './pages/UserFormPage';
import UserPermissionsPage from './pages/UserPermissionsPage';
import Security from "@/pages/Security";
import Branches from "@/pages/Branches";
import Transactions from "@/pages/Transactions";
import TransactionDetails from "@/pages/TransactionDetails";
import ExpensesPage from "@/pages/ExpensesPage";
import IncomePage from "@/pages/IncomePage";
import ReceivePayments from "@/pages/ReceivePayments";
import Notifications from "@/pages/Notifications";
import LoanApprovals from "@/pages/LoanApprovals";
import MfaEnroll from "@/pages/MfaEnroll";
import MfaPrompt from "@/pages/MfaPrompt";
import SecurityMfa from "@/pages/SecurityMfa";
import { useAuth } from "@/contexts/AuthContext";
import ActivityLogs from "@/pages/ActivityLogs";
import Backups from "@/pages/Backups";
import LoanOfficers from "@/pages/LoanOfficers";

const queryClient = new QueryClient();

const RequireMfa: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // MFA temporarily disabled for easier initial setup
  // const { user } = useAuth();
  // const location = useLocation();
  // const inMfa = location.pathname.startsWith('/mfa');
  // Check a short-lived local flag indicating MFA verification for this user
  // const isMfaVerified = (() => {
  //   try {
  //     if (!user) return false;
  //     const key = `mfa_verified_${user.id}`;
  //     const raw = localStorage.getItem(key);
  //     if (!raw) return false;
  //     const parsed = JSON.parse(raw || '{}');
  //     const expiresAt = typeof parsed.expiresAt === 'number' ? parsed.expiresAt : 0;
  //     if (Date.now() > expiresAt) {
  //       localStorage.removeItem(key);
  //       return false;
  //     }
  //     return true;
  //   } catch {
  //     return false;
  //   }
  // })();

  // Require MFA for any authenticated user - DISABLED
  // if (user && !inMfa && !isMfaVerified) {
  //   return <Navigate to="/mfa" replace state={{ from: location.pathname }} />;
  // }
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <NotificationProvider>
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="overflow-x-hidden">
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/mfa/enroll" element={<MfaEnroll />} />
              <Route path="/security/mfa" element={<SecurityMfa />} />
              <Route path="/mfa" element={<MfaPrompt />} />
              <Route path="/" element={<RequireMfa><AppLayout /></RequireMfa>}>
                <Route index element={<Dashboard />} />
                <Route path="loan-officer" element={<LoanOfficer />} />
                <Route path="loan-officer/:id" element={<LoanOfficerProfilePage />} />
                <Route path="groups" element={<Groups />} />
                <Route path="groups/new" element={<GroupEdit />} />
                <Route path="groups/:groupId" element={<GroupDetails />} />
                <Route path="groups/:groupId/edit" element={<GroupEdit />} />
                <Route path="groups/:groupId/members" element={<GroupMembers />} />
                <Route path="bulk-payment" element={<BulkPayment />} />
                <Route path="members" element={<Members />} />
                <Route path="members/new" element={<MemberFormPage />} />
                <Route path="members/:id" element={<MemberProfilePage />} />
                <Route path="members/:id/edit" element={<MemberFormPage />} />
                <Route path="search-member" element={<SearchMember />} />
                
                {/* Note: Removed duplicate /loans route. Using LoanAccounts as per your import. */}
                <Route path="loans" element={<LoanAccounts />} /> 
                <Route path="loans/new" element={<LoanFormPage />} /> 
                <Route path="loans/approvals" element={<LoanApprovals />} />
                <Route path="loans/:id" element={<LoanDetailsPage />} />
                <Route path="loans/:id/edit" element={<LoanFormPage />} /> 
                <Route path="receive-payments" element={<ReceivePayments />} />
                
                <Route path="daily-overdue" element={<DailyOverdue />} />
                <Route path="realizable-report" element={<RealizableReport />} />
                <Route path="realizable-assets/new" element={<AssetFormPage />} />
                <Route path="realizable-assets/:id/edit" element={<AssetFormPage />} />
                <Route path="dormant-members" element={<DormantMembers />} />
                <Route path="bad-debt" element={<BadDebt />} />
                
                <Route path="profile" element={<Profile />} />
                <Route path="settings" element={<Settings />} />
                
                {/* Note: Removed duplicate /users route. Using Users as per your import. */}
                <Route path="users" element={<Users />} />
                <Route path="users/new" element={<UserFormPage />} />
                <Route path="users/:id/edit" element={<UserFormPage />} />
                <Route path="users/:id/permissions" element={<UserPermissionsPage />} />
                
                <Route path="security" element={<Security />} />
                <Route path="branches" element={<Branches />} />
                <Route path="activity-logs" element={<ActivityLogs />} />
                <Route path="backups" element={<Backups />} />
                <Route path="loan-officers" element={<LoanOfficers />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="transactions/:id" element={<TransactionDetails />} />
                <Route path="expenses" element={<ExpensesPage />} />
                <Route path="income" element={<IncomePage />} />
                <Route path="notifications" element={<Notifications />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </BrowserRouter>
        </TooltipProvider>
      </NotificationProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;