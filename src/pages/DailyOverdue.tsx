import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Clock, AlertTriangle, Phone, Eye, Loader2, Banknote, DollarSign, TrendingUp, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table';
import { ExportDropdown } from '@/components/ui/ExportDropdown';
import { DateRangeFilter, DateRange, filterDataByDateRange } from '@/components/ui/DateRangeFilter';

// --- Type Definitions ---
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
interface OverdueItem {
  id: string;
  account_number: string;
  member_name: string;
  member_id: string;
  phone_number: string;
  branch_name: string;
  branch_id: string | number;
  loan_officer_id: string;
  overdue_amount: number;
  days_overdue: number;
  last_payment_date?: string;
  loan_balance: number;
  loan_officer_name: string;
  risk_level: RiskLevel;
  loan_program: string;
  principal_amount: number;
  applied_at: string;
  due_date: string;
  total_installments: number;
  paid_installments: number;
  overdue_installments: number;
  next_due_date: string;
  installment_amount: number;
}

const DailyOverdue: React.FC = () => {
  const { user } = useAuth();
  const [overdueItems, setOverdueItems] = useState<OverdueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });

  const fetchOverdueLoans = async () => {
    if (!user) return;
    try {
      const { data, error } = await (supabase as any).rpc('get_unified_overdue_loans_report', { requesting_user_id: user.id });
      if (error) throw error;
      setOverdueItems((data as any) || []);
    } catch (error: any) {
      toast.error('Failed to fetch overdue report', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverdueLoans();
    
    // Listen for changes that might affect the overdue status
    const subscription = supabase.channel('overdue-report-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, fetchOverdueLoans)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, fetchOverdueLoans)
      .subscribe();
      
    return () => { supabase.removeChannel(subscription); };
  }, [user]);

     const filteredItems = overdueItems.filter(item =>
     item.member_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     item.account_number.toLowerCase().includes(searchTerm.toLowerCase())
   );

  // Apply date filtering to the already filtered items
  const dateFilteredItems = filterDataByDateRange(filteredItems, dateRange, 'last_payment_date');

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);
  const getRiskBadgeVariant = (risk: RiskLevel) => {
    switch (risk) { case 'low': return 'default'; case 'medium': return 'warning'; case 'high': return 'destructive'; case 'critical': return 'destructive'; default: return 'secondary'; }
  };

  const columns = [
    { header: 'Member', cell: (row: OverdueItem) => (
      <div className="space-y-1">
                 <Link to={`/members/${row.member_id}`} className="font-medium text-primary hover:underline block">{row.member_name}</Link>
        <div className="text-xs text-muted-foreground">{row.phone_number}</div>
      </div>
    )},
         { header: 'Loan Details', cell: (row: OverdueItem) => (
       <div className="space-y-1">
         <Link to={`/loans/${row.id}`} className="font-mono text-xs hover:underline block">{row.account_number}</Link>
         <Badge variant="outline" className="text-xs capitalize">{row.loan_program.replace('_', ' ')}</Badge>
         <div className="text-xs text-muted-foreground">
           {row.paid_installments}/{row.total_installments} installments
         </div>
       </div>
     )},
         { header: 'Overdue Details', cell: (row: OverdueItem) => (
       <div className="space-y-1">
         <div className="font-semibold text-destructive">{formatCurrency(row.overdue_amount)}</div>
         <div className="text-xs text-muted-foreground">{row.days_overdue} days overdue</div>
         <div className="text-xs text-muted-foreground">Due: {new Date(row.due_date).toLocaleDateString('en-KE')}</div>
       </div>
     )},
         { header: 'Loan Balance', cell: (row: OverdueItem) => (
       <div className="space-y-1">
         <div className="font-mono font-semibold">{formatCurrency(row.loan_balance)}</div>
         <div className="text-xs text-muted-foreground">Principal: {formatCurrency(row.principal_amount)}</div>
         <div className="text-xs text-muted-foreground">Applied: {new Date(row.applied_at).toLocaleDateString('en-KE')}</div>
       </div>
     )},
    { header: 'Risk & Branch', cell: (row: OverdueItem) => (
      <div className="space-y-1">
        <Badge variant="default" className="capitalize">{(row as any).risk_level}</Badge>
        <div className="text-xs text-muted-foreground">{row.branch_name}</div>
        <div className="text-xs text-muted-foreground">{row.loan_officer_name}</div>
      </div>
    )},
    { header: 'Actions', cell: (row: OverdueItem) => (
      <div className="flex flex-col gap-2">
        <Button asChild variant="outline" size="sm" className="w-full">
          <a href={`tel:${row.phone_number}`} className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Call
          </a>
        </Button>
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link to={`/loans/${row.id}`} className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            View
          </Link>
        </Button>
                 <Button asChild variant="outline" size="sm" className="w-full">
           <Link to={`/members/${row.member_id}`} className="flex items-center gap-2">
             <Users className="h-4 w-4" />
             Member
           </Link>
         </Button>
      </div>
    )},
  ];

     const exportColumns = [
     { header: 'Member Name', accessorKey: 'member_name' },
     { header: 'Phone Number', accessorKey: 'phone_number' },
           { header: 'Account Number', accessorKey: 'account_number' },
      { header: 'Loan Program', accessorKey: 'loan_program' },
     { header: 'Branch', accessorKey: 'branch_name' },
     { header: 'Days Overdue', accessorKey: 'days_overdue' },
     { header: 'Overdue Amount', accessorKey: (row: OverdueItem) => formatCurrency(row.overdue_amount) },
     { header: 'Total Balance', accessorKey: (row: OverdueItem) => formatCurrency(row.loan_balance) },
     { header: 'Principal Amount', accessorKey: (row: OverdueItem) => formatCurrency(row.principal_amount) },
     { header: 'Installments Progress', accessorKey: (row: OverdueItem) => `${row.paid_installments}/${row.total_installments}` },
     { header: 'Applied Date', accessorKey: (row: OverdueItem) => new Date(row.applied_at).toLocaleDateString('en-KE') },
           { header: 'Due Date', accessorKey: (row: OverdueItem) => new Date(row.due_date).toLocaleDateString('en-KE') },
     { header: 'Last Payment Date', accessorKey: (row: OverdueItem) => row.last_payment_date ? new Date(row.last_payment_date).toLocaleDateString('en-KE') : 'N/A' },
     { header: 'Risk Level', accessorKey: 'risk_level' },
     { header: 'Loan Officer', accessorKey: 'loan_officer_name' },
   ];
  
  const totalOverdueAmount = overdueItems.reduce((sum, item) => sum + item.overdue_amount, 0);
  const criticalRiskCount = overdueItems.filter(item => item.risk_level === 'critical').length;

  if (loading) { return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>; }

  return (
    <div className="space-y-6 p-2 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Loans Overdue</h1>
          <p className="text-muted-foreground">Monitor overdue loans and payment collection progress for both big and small loans.</p>
        </div>
        <ExportDropdown 
          data={dateFilteredItems} 
          columns={exportColumns} 
          fileName="loans-overdue-report" 
          reportTitle="Loans Overdue Report"
          dateRange={dateRange}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Overdue" value={overdueItems.length} icon={Clock} />
        <StatCard title="Overdue Amount" value={formatCurrency(totalOverdueAmount)} icon={AlertTriangle} />
        <StatCard title="Critical Risk" value={criticalRiskCount} icon={AlertTriangle} />
                 <StatCard title="Big Loans" value={overdueItems.filter(item => item.loan_program === 'big_loan').length} icon={Banknote} />
      </div>
      
             {/* Additional Stats */}
       <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
         <StatCard title="Small Loans" value={overdueItems.filter(item => item.loan_program === 'small_loan').length} icon={Banknote} />
         <StatCard title="Average Days" value={`${Math.round(overdueItems.reduce((sum, item) => sum + item.days_overdue, 0) / Math.max(overdueItems.length, 1))} days`} icon={Clock} />
         <StatCard title="Total Balance" value={formatCurrency(overdueItems.reduce((sum, item) => sum + item.loan_balance, 0))} icon={DollarSign} />
         <StatCard title="Collection Rate" value={`${Math.round((overdueItems.reduce((sum, item) => sum + item.paid_installments, 0) / Math.max(overdueItems.reduce((sum, item) => sum + item.total_installments, 0), 1)) * 100)}%`} icon={TrendingUp} />
       </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle>Overdue Loans</CardTitle>
                <CardDescription>
                  Showing {dateFilteredItems.length} of {filteredItems.length} overdue items
                  {dateRange.from && dateRange.to && (
                    <span className="text-brand-blue-600 font-medium">
                      {' '}• Filtered by date range
                    </span>
                  )}
                  <span className="text-blue-600 font-medium ml-2">
                    • Latest overdue shown at top
                  </span>
                </CardDescription>
              </div>
            </div>
            
            {/* Filters Row - Better positioned and spaced */}
            <div className="flex flex-col lg:flex-row gap-4 w-full">
              {/* Date Filter - Takes priority */}
              <div className="flex-shrink-0">
                <DateRangeFilter
                  onDateRangeChange={setDateRange}
                  placeholder="Filter by date"
                  className="w-full lg:w-auto"
                />
              </div>
              
              {/* Search Filter */}
              <div className="flex-1 min-w-0">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by member or account..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="pl-9 w-full" 
                  />
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={dateFilteredItems} emptyStateMessage="No overdue loans found matching your criteria." />
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ElementType }> = ({ title, value, icon: Icon }) => (
  <Card className="bg-gradient-to-br from-brand-blue-50 to-brand-blue-100 border-brand-blue-200 hover:border-brand-blue-300 transition-all duration-200 hover:shadow-md">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-brand-blue-800">{title}</CardTitle>
      <Icon className="h-4 w-4 text-brand-blue-600" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-brand-blue-700">{value}</div>
    </CardContent>
  </Card>
);

export default DailyOverdue;