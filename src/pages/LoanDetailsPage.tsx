import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, Banknote, Calendar, TrendingUp, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

import { ManualPaymentEntry } from '@/components/loans/ManualPaymentEntry';
import { PaymentHistory } from '@/components/loans/PaymentHistory';
import { CollectionLogs } from '@/components/loans/CollectionLogs';

// --- Type Definitions ---
interface LoanDetails {
  id: string;
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

  // This function is now just for the initial load and background consistency checks
  const fetchLoanDetails = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('loans_with_details')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setLoan(data as LoanDetails);
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
    <div className="space-y-6 p-2 sm:p-4 md:p-6">
      <div className="flex justify-between items-center">
        <div>
          <Button asChild variant="outline" size="sm" className="mb-4">
            <Link to="/loans"><ArrowLeft className="mr-2 h-4 w-4" />Back to Loans</Link>
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Loan Account: {loan.account_number}</h1>
          <p className="text-muted-foreground">Managing loan for member: <strong>{loan.member_name}</strong></p>
        </div>
      </div>

      {/* Summary Cards will now update instantly */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={DollarSign} title="Outstanding Balance" value={formatCurrency(loan.current_balance)} variant={loan.current_balance > 0 ? 'warning' : 'success'} />
        <StatCard icon={Banknote} title="Principal Amount" value={formatCurrency(loan.principal_amount)} />
        <StatCard icon={TrendingUp} title="Total Repaid" value={formatCurrency(loan.total_paid)} />
        <StatCard icon={Calendar} title="Due Date" value={new Date(loan.due_date).toLocaleDateString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs defaultValue="payment_history">
            <TabsList>
              <TabsTrigger value="payment_history">Payment History</TabsTrigger>
              <TabsTrigger value="collection_logs">Collection Logs</TabsTrigger>
              <TabsTrigger value="loan_details">Full Details</TabsTrigger>
            </TabsList>
            <TabsContent value="payment_history">
              {/* This component will refetch itself on the new payment, showing the new record */}
              <PaymentHistory loanId={loan.id} />
            </TabsContent>
            <TabsContent value="collection_logs">
              <CollectionLogs loanId={loan.id} />
            </TabsContent>
            <TabsContent value="loan_details">
              <Card>
                <CardHeader><CardTitle>Loan Agreement Details</CardTitle></CardHeader>
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
        <div className="lg:col-span-1">
          <ManualPaymentEntry loan={loan} onPaymentSuccess={handlePaymentSuccess} />
        </div>
      </div>
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
        default: 'text-foreground'
    };
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className={`text-2xl font-bold ${variantClasses[variant]}`}>{value}</div>
            </CardContent>
        </Card>
    );
};

const InfoItem: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="flex justify-between items-center border-b pb-2">
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="font-medium text-sm">{value}</p>
  </div>
);

export default LoanDetailsPage;