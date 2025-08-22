import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Clock, AlertTriangle, Phone, Eye, Loader2 } from 'lucide-react';
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
  overdue_amount: number;
  days_overdue: number;
  last_payment_date?: string;
  loan_balance: number;
  loan_officer_name: string;
  risk_level: RiskLevel;
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
      const { data, error } = await supabase.rpc('get_overdue_loans_report', { requesting_user_id: user.id });
      if (error) throw error;
      setOverdueItems(data || []);
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
      <Link to={`/members/${row.member_id}`} className="font-medium text-primary hover:underline">{row.member_name}</Link>
    )},
    { header: 'Loan Acc.', cell: (row: OverdueItem) => <Link to={`/loans/${row.id}`} className="font-mono text-xs hover:underline">{row.account_number}</Link> },
    { header: 'Overdue Details', cell: (row: OverdueItem) => (
      <div>
        <div className="font-semibold text-destructive">{formatCurrency(row.overdue_amount)}</div>
        <div className="text-xs text-muted-foreground">{row.days_overdue} days overdue</div>
      </div>
    )},
    { header: 'Total Balance', cell: (row: OverdueItem) => <div className="font-mono">{formatCurrency(row.loan_balance)}</div> },
    { header: 'Risk Level', cell: (row: OverdueItem) => <Badge variant={getRiskBadgeVariant(row.risk_level)} className="capitalize">{row.risk_level}</Badge> },
    { header: 'Assigned Officer', cell: (row: OverdueItem) => row.loan_officer_name },
    { header: 'Actions', cell: (row: OverdueItem) => (
      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" size="icon"><a href={`tel:${row.phone_number}`}><Phone className="h-4 w-4" /></a></Button>
        <Button asChild variant="outline" size="icon"><Link to={`/loans/${row.id}`}><Eye className="h-4 w-4" /></Link></Button>
      </div>
    )},
  ];

  const exportColumns = [
    { header: 'Member Name', accessorKey: 'member_name' },
    { header: 'Loan Account', accessorKey: 'account_number' },
    { header: 'Phone Number', accessorKey: 'phone_number' },
    { header: 'Branch', accessorKey: 'branch_name' },
    { header: 'Days Overdue', accessorKey: 'days_overdue' },
    { header: 'Overdue Amount', accessorKey: (row: OverdueItem) => formatCurrency(row.overdue_amount) },
    { header: 'Total Balance', accessorKey: (row: OverdueItem) => formatCurrency(row.loan_balance) },
    { header: 'Risk Level', accessorKey: 'risk_level' },
  ];
  
  const totalOverdueAmount = overdueItems.reduce((sum, item) => sum + item.overdue_amount, 0);
  const criticalRiskCount = overdueItems.filter(item => item.risk_level === 'critical').length;

  if (loading) { return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>; }

  return (
    <div className="space-y-6 p-2 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Daily Overdue Report</h1>
          <p className="text-muted-foreground">Monitor overdue loans and payment collection progress.</p>
        </div>
        <ExportDropdown 
          data={dateFilteredItems} 
          columns={exportColumns} 
          fileName="daily-overdue-report" 
          reportTitle="Daily Overdue Report"
          dateRange={dateRange}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Overdue" value={overdueItems.length} icon={Clock} />
        <StatCard title="Overdue Amount" value={formatCurrency(totalOverdueAmount)} icon={AlertTriangle} />
        <StatCard title="Critical Risk" value={criticalRiskCount} icon={AlertTriangle} />
        <StatCard title="Average Days" value={`${Math.round(overdueItems.reduce((sum, item) => sum + item.days_overdue, 0) / Math.max(overdueItems.length, 1))} days`} icon={Clock} />
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
                    <span className="text-brand-green-600 font-medium">
                      {' '}• Filtered by date range
                    </span>
                  )}
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
  <Card className="bg-gradient-to-br from-brand-green-50 to-brand-green-100 border-brand-green-200 hover:border-brand-green-300 transition-all duration-200 hover:shadow-md">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-brand-green-800">{title}</CardTitle>
      <Icon className="h-4 w-4 text-brand-green-600" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-brand-green-700">{value}</div>
    </CardContent>
  </Card>
);

export default DailyOverdue;