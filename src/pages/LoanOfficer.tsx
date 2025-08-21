import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, UserCheck, Landmark, Banknote, TrendingUp, Users, RefreshCw, Eye, MoreHorizontal, Mail, Phone, MapPin, Loader2, Filter, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table';
import { ExportDropdown } from '@/components/ui/ExportDropdown'; // Assuming this component exists and is imported correctly

// --- Type Definition ---
interface LoanOfficer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  branch_name: string;
  created_at: string;
  profile_picture_url?: string;
  total_loans: number;
  active_loans: number;
  pending_loans: number;
  completed_loans: number;
  defaulted_loans: number;
  total_disbursed: number;
  total_balance: number;
  status: 'active' | 'inactive';
}

const LoanOfficerPage: React.FC = () => {
  const { user } = useAuth();
  const [officers, setOfficers] = useState<LoanOfficer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const fetchLoanOfficers = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Secure RPC call, filtering data based on user role handled by the function
      const { data, error } = await supabase.rpc('get_officer_performance_data', { requesting_user_id: user.id });
      if (error) throw error;
      
      const mappedOfficers: LoanOfficer[] = (data || []).map(o => ({ ...o, status: o.total_loans > 0 ? 'active' : 'inactive' }));
      setOfficers(mappedOfficers);
    } catch (error: any) {
      toast.error('Failed to fetch officer data', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoanOfficers();
    // Real-time listener for continuous data synchronization
    const channel = supabase.channel('officer_stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => {
        toast.info("Data refreshed.");
        fetchLoanOfficers();
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const filteredOfficers = officers.filter(o => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = o.name.toLowerCase().includes(searchLower) || o.branch_name.toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);

  // --- DataTable Column Definitions ---
  const columns = [
    { 
      header: 'Officer', 
      cell: (row: LoanOfficer) => (
        <div className="flex items-center space-x-3">
            <Link to={`/loan-officer/${row.id}`} className="font-medium text-primary hover:underline">{row.name}</Link>
        </div>
      ) 
    },
    { 
      header: 'Contact', 
      cell: (row: LoanOfficer) => (
          <div className="text-sm text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{row.email}</div>
      ) 
    },
    { header: 'Branch', cell: (row: LoanOfficer) => row.branch_name },
    { header: 'Portfolio', cell: (row: LoanOfficer) => (
        <div>
            <div>{row.active_loans} Active / {row.total_loans} Total</div>
            <div className="text-xs text-muted-foreground">{row.pending_loans} Pending</div>
        </div>
    )},
    { header: 'Financials', cell: (row: LoanOfficer) => (
        <div>
            <div className="font-mono">{formatCurrency(row.total_balance)}</div>
            <div className="text-xs text-muted-foreground">Outstanding Balance</div>
        </div>
    )},
    { header: 'Performance', cell: (row: LoanOfficer) => (
        <div className="text-right">
            <div className="text-sm text-green-600">{row.completed_loans} Completed</div>
            <div className={`text-xs ${row.defaulted_loans > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>{row.defaulted_loans} Defaulted</div>
        </div>
    )},
    { header: 'Actions', cell: (row: LoanOfficer) => (
        <div className="text-right">
            <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild><Link to={`/loan-officer/${row.id}`}><Eye className="h-4 w-4 mr-2" /> View Profile</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to={`/users/${row.id}/edit`}><Edit className="h-4 w-4 mr-2" /> Edit User</Link></DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )},
  ];

  const totalOutstanding = officers.reduce((sum, o) => sum + (o.total_balance || 0), 0);
  const totalDisbursed = officers.reduce((sum, o) => sum + (o.total_disbursed || 0), 0);
  const activeOfficers = officers.filter(o => o.status === 'active').length;

  if (loading) { return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>; }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Loan Officer Dashboard</h1>
          <p className="text-muted-foreground">Manage and monitor officer performance.</p>
        </div>
        <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => fetchLoanOfficers()}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
            {/* Export data */}
            <ExportDropdown data={filteredOfficers} columns={columns} fileName="loan_officer_report" reportTitle="Loan Officer Performance Report" />
            <Button asChild><Link to="/users"><UserCheck className="h-4 w-4 mr-2" /> Manage Users</Link></Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Officers" value={officers.length} icon={Users} />
        <StatCard title="Active Officers" value={activeOfficers} icon={UserCheck} />
        <StatCard title="Total Disbursed" value={formatCurrency(totalDisbursed)} icon={Landmark} />
        <StatCard title="Total Outstanding" value={formatCurrency(totalOutstanding)} icon={TrendingUp} />
      </div>
      
      <Card>
        <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <CardTitle>Officer Directory</CardTitle>
                <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search officers..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" /></div>
            </div>
        </CardHeader>
        <CardContent>
            <DataTable columns={columns} data={filteredOfficers} emptyStateMessage="No loan officers found for your role." />
        </CardContent>
      </Card>
    </div>
  );
};

// --- Helper Component ---
const StatCard: React.FC<{ title: string; value: string | number; icon: React.ElementType }> = ({ title, value, icon: Icon }) => (
    <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card>
);

export default LoanOfficerPage;