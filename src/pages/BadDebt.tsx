import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, AlertTriangle, ShieldAlert, Loader2, Banknote, Users, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table';
import { ExportDropdown } from '@/components/ui/ExportDropdown';
import { WriteOffLoanDialog } from '@/components/loans/WriteOffLoanDialog'; // Import our new component

// --- Type Definitions ---
interface BadDebtRecord {
  id: string; // Loan ID
  account_number: string;
  member_name: string;
  member_id: string;
  principal_amount: number;
  written_off_balance: number;
  loan_officer_name: string;
  branch_name: string;
  written_off_date: string;
}

const BadDebt: React.FC = () => {
  const { user, userRole } = useAuth();
  const [records, setRecords] = useState<BadDebtRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWriteOffDialogOpen, setIsWriteOffDialogOpen] = useState(false);

  useEffect(() => {
    if (userRole === 'super_admin') {
      fetchData();
      const subscription = supabase.channel('bad-debt-realtime').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'loans', filter: 'status=eq.bad_debt' }, fetchData).subscribe();
      return () => { supabase.removeChannel(subscription); };
    } else {
      setLoading(false);
    }
  }, [user, userRole]);

  const fetchData = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc('get_bad_debt_report', { requesting_user_id: user.id });
      if (error) throw error;
      setRecords(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch bad debt report', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);

  const columns = [
    { header: 'Member', cell: (row: BadDebtRecord) => <Link to={`/members/${row.member_id}`} className="font-medium text-primary hover:underline">{row.member_name}</Link> },
    { header: 'Loan Acc.', cell: (row: BadDebtRecord) => <div className="font-mono text-xs">{row.account_number}</div> },
    { header: 'Amount Written Off', cell: (row: BadDebtRecord) => <div className="font-mono text-right text-destructive">{formatCurrency(row.written_off_balance)}</div> },
    { header: 'Original Principal', cell: (row: BadDebtRecord) => <div className="font-mono text-right">{formatCurrency(row.principal_amount)}</div> },
    { header: 'Branch', cell: (row: BadDebtRecord) => row.branch_name },
    { header: 'Assigned Officer', cell: (row: BadDebtRecord) => row.loan_officer_name },
    { header: 'Date Written Off', cell: (row: BadDebtRecord) => new Date(row.written_off_date).toLocaleDateString() },
    { header: 'Actions', cell: (row: BadDebtRecord) => <div className="text-right"><Button asChild variant="outline" size="icon"><Link to={`/loans/${row.id}`}><Eye className="h-4 w-4" /></Link></Button></div> },
  ];
  
  const exportColumns = columns.slice(0, -1).map(c => ({ header: c.header, accessorKey: (row: BadDebtRecord) => c.cell(row) }));

  if (loading) { return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>; }

  if (userRole !== 'super_admin') {
    return (
      <div className="p-2 sm:p-4 md:p-6"><Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-yellow-500" />
          <CardTitle className="mt-4">Access Denied</CardTitle>
          <CardDescription>Only Super Admins can access the Bad Debt report.</CardDescription>
        </CardHeader>
      </Card></div>
    );
  }

  const totalWrittenOff = records.reduce((sum, r) => sum + r.written_off_balance, 0);

  return (
    <>
      <div className="space-y-6 p-2 sm:p-4 md:p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Bad Debt Accounts</h1>
            <p className="text-muted-foreground mt-1">A report of all irrecoverable loan accounts.</p>
          </div>
          <div className="flex gap-2">
            <ExportDropdown data={records} columns={exportColumns} fileName="bad_debt_report" reportTitle="Bad Debt Report" />
            <Button onClick={() => setIsWriteOffDialogOpen(true)}><AlertTriangle className="mr-2 h-4 w-4" />Write-off a Loan</Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatCard title="Total Accounts Written Off" value={records.length} />
          <StatCard title="Total Amount Written Off" value={formatCurrency(totalWrittenOff)} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Written-off Loan Details</CardTitle>
            <CardDescription>Showing all {records.length} loans that have been marked as bad debt.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable columns={columns} data={records} emptyStateMessage="No bad debt accounts found." />
          </CardContent>
        </Card>
      </div>

      <WriteOffLoanDialog open={isWriteOffDialogOpen} onOpenChange={setIsWriteOffDialogOpen} onSuccess={fetchData} />
    </>
  );
};

const StatCard: React.FC<{title: string, value: string | number}> = ({ title, value }) => (
  <Card className="bg-gradient-to-br from-brand-green-50 to-brand-green-100 border-brand-green-200 hover:border-brand-green-300 transition-all duration-200 hover:shadow-md">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium text-brand-green-800">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-brand-green-700">{value}</div>
    </CardContent>
  </Card>
);

export default BadDebt;