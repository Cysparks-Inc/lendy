import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, Banknote, Calendar, TrendingUp, DollarSign, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

import { ManualPaymentEntry } from '@/components/loans/ManualPaymentEntry';
import { PaymentHistory } from '@/components/loans/PaymentHistory';

import { CommunicationLogs } from '@/components/loans/CommunicationLogs';
import { LogCommunicationDialog } from '@/components/loans/LogCommunicationDialog';

// --- Type Definitions ---
interface LoanDetails {
  id: string;
  member_id: string;
  member_name: string;
  principal_amount: number;
  account_number: string;
  current_balance: number;
  total_paid: number;
  due_date: string;
  issue_date: string;
  branch_name: string;
  loan_officer_name: string | null;
  interest_rate: number;
  status: string;
}

const LoanDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [loan, setLoan] = useState<LoanDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCommunicationDialogOpen, setIsCommunicationDialogOpen] = useState(false);
  const [communicationLogsKey, setCommunicationLogsKey] = useState(0); // For forcing refresh

  // Function to refresh communication logs
  const refreshCommunicationLogs = () => {
    setCommunicationLogsKey(prev => prev + 1);
  };

  // This function is now just for the initial load and background consistency checks
  const fetchLoanDetails = async () => {
    if (!id) return;
    try {
      // Step 1: Fetch the loan data
      const { data: loanData, error: loanError } = await supabase
        .from('loans')
        .select('*')
        .eq('id', id)
        .single();

      if (loanError) throw loanError;
      
      console.log('Raw loan data:', loanData);
      
      // Step 2: Fetch related data (member, branch, officer names)
      const memberId = loanData.member_id || loanData.customer_id;
      const [memberRes, branchRes, officerRes] = await Promise.all([
        memberId ? supabase.from('members').select('full_name').eq('id', memberId).single() : { data: null, error: null },
        loanData.branch_id ? supabase.from('branches').select('name').eq('id', loanData.branch_id).single() : { data: null, error: null },
        loanData.loan_officer_id ? supabase.from('profiles').select('full_name').eq('id', loanData.loan_officer_id).single() : { data: null, error: null }
      ]);
      
      // Step 3: Transform the data
      const transformedLoan: LoanDetails = {
        id: loanData.id,
        member_id: memberId || '',
        member_name: memberRes?.data?.full_name || `Unknown Member (${memberId?.slice(0, 8) || 'N/A'})`,
        principal_amount: loanData.principal_amount || 0,
        account_number: loanData.application_no || loanData.id.slice(0, 8),
        current_balance: loanData.current_balance || 0,
        total_paid: loanData.total_paid || 0,
        due_date: loanData.due_date || new Date().toISOString().split('T')[0],
        issue_date: loanData.applied_at || new Date().toISOString().split('T')[0],
        branch_name: branchRes?.data?.name || 'Unknown Branch',
        loan_officer_name: officerRes?.data?.full_name || 'Unassigned Officer',
        interest_rate: loanData.interest_rate || 0,
        status: loanData.status || 'pending'
      };
      
      console.log('Transformed loan data:', transformedLoan);
      setLoan(transformedLoan);
    } catch (error: any) {
      toast.error('Failed to fetch loan details', { description: error.message });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoanDetails();
  }, [id]);

  // --- THE UPDATED SUCCESS HANDLER ---
  const handlePaymentSuccess = (paymentAmount: number) => {
    toast.success('Payment recorded successfully!');
    
    // 1. Optimistic UI Update: Update the local state immediately
    if (loan) {
      setLoan(prevLoan => {
        if (!prevLoan) return null;
        return {
          ...prevLoan,
          current_balance: prevLoan.current_balance - paymentAmount,
          total_paid: prevLoan.total_paid + paymentAmount,
        };
      });
    }

    // 2. Background Sync: Refetch data to ensure consistency with the database trigger.
    // This will correct any minor discrepancies and update the status if the loan becomes 'repaid'.
    setTimeout(() => fetchLoanDetails(), 500); // Small delay to give the trigger time
  };

  const formatCurrency = (amount: number): string => 
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!loan) {
    return (
      <div className="text-center p-10">
        <h2 className="text-xl font-semibold">Loan Not Found</h2>
        <p className="text-muted-foreground">The requested loan could not be found.</p>
        <Button asChild variant="outline" className="mt-4"><Link to="/loans"><ArrowLeft className="mr-2 h-4 w-4" />Back to Loans</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-3 sm:p-4 md:p-6">
      {/* Clean Header Section */}
      <div className="space-y-4">
        {/* Back Button */}
        <Button asChild variant="outline" size="sm">
          <Link to="/loans">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Loans
          </Link>
        </Button>
        
        {/* Main Title */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Loan Account: {loan.account_number}
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Managing loan for member: <strong className="text-foreground">{loan.member_name}</strong>
          </p>
        </div>

        {/* Member Profile Link */}
        {loan.member_id && (
          <div className="pt-2">
            <Button asChild variant="outline" size="sm">
              <Link to={`/members/${loan.member_id}`}>
                <MessageSquare className="mr-2 h-4 w-4" />
                View Member Profile
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Summary Cards - Clean Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard icon={DollarSign} title="Outstanding Balance" value={formatCurrency(loan.current_balance)} variant={loan.current_balance > 0 ? 'warning' : 'success'} />
        <StatCard icon={Banknote} title="Principal Amount" value={formatCurrency(loan.principal_amount)} />
        <StatCard icon={TrendingUp} title="Total Repaid" value={formatCurrency(loan.total_paid)} />
        <StatCard icon={Calendar} title="Due Date" value={new Date(loan.due_date).toLocaleDateString()} />
      </div>

      {/* Main Content Area - Clean Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Left Column - Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="payment_history" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="payment_history">Payment History</TabsTrigger>
              <TabsTrigger value="communication_logs">Communication Logs</TabsTrigger>
              <TabsTrigger value="loan_details">Full Details</TabsTrigger>
            </TabsList>
            
            <TabsContent value="payment_history" className="space-y-4">
              <PaymentHistory loanId={loan.id} />
            </TabsContent>
            
            <TabsContent value="communication_logs" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Communication History</h3>
                <Button onClick={() => setIsCommunicationDialogOpen(true)}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Log Communication
                </Button>
              </div>
              <CommunicationLogs 
                key={communicationLogsKey}
                loanId={loan.id} 
                memberId={loan.member_id || null} 
                memberName={loan.member_name}
                onRefresh={refreshCommunicationLogs}
              />
            </TabsContent>
            
            <TabsContent value="loan_details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Loan Agreement Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <InfoItem label="Member Name" value={loan.member_name} />
                  <InfoItem label="Branch" value={loan.branch_name} />
                  <InfoItem label="Loan Officer" value={loan.loan_officer_name || 'N/A'} />
                  <InfoItem label="Issue Date" value={new Date(loan.issue_date).toLocaleDateString()} />
                  <InfoItem label="Interest Rate" value={`${loan.interest_rate}%`} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Payment Entry */}
        <div className="lg:col-span-1">
          <ManualPaymentEntry loan={loan} onPaymentSuccess={handlePaymentSuccess} />
        </div>
      </div>

      {/* Communication Log Dialog */}
      <LogCommunicationDialog
        open={isCommunicationDialogOpen}
        onOpenChange={setIsCommunicationDialogOpen}
        loanId={loan.id}
        memberId={loan.member_id}
        memberName={loan.member_name}
        onLogSuccess={() => {
          refreshCommunicationLogs();
        }}
      />
    </div>
  );
};

// --- Helper Components (Typed) ---

type StatCardProps = {
  icon: React.ElementType;
  title: string;
  value: string | number;
  variant?: 'warning' | 'success' | 'default';
};

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, title, value, variant = 'default' }) => {
    const variantClasses = {
        warning: 'text-amber-600',
        success: 'text-green-600',
        default: 'text-brand-green-700'
    };
    return (
        <Card className="bg-gradient-to-br from-brand-green-50 to-brand-green-100 border-brand-green-200 hover:border-brand-green-300 transition-all duration-200 hover:shadow-md p-3 sm:p-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0 pt-0">
                <CardTitle className="text-xs md:text-sm font-medium text-brand-green-800">{title}</CardTitle>
                <Icon className="h-4 w-4 text-brand-green-600" />
            </CardHeader>
            <CardContent className="px-0 pb-0">
                <div className={`text-xl md:text-2xl font-bold ${variantClasses[variant]}`}>{value}</div>
            </CardContent>
        </Card>
    );
};

const InfoItem: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="flex justify-between items-center py-3 border-b border-gray-100 last:border-b-0">
    <p className="text-sm font-medium text-gray-600">{label}</p>
    <p className="text-sm font-semibold text-gray-900">{value}</p>
  </div>
);

export default LoanDetailsPage;