import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, UserCheck, Landmark, Banknote, TrendingUp, Users, RefreshCw, Eye, MoreHorizontal, Mail, Edit, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table';
import { ExportDropdown } from '@/components/ui/ExportDropdown';

// --- Type Definition ---
interface LoanOfficer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  branch_name: string;
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
  const { user, userRole } = useAuth();
  const [officers, setOfficers] = useState<LoanOfficer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  const fetchLoanOfficers = async () => {
    if (!user) return;
    setLoading(true);
    try {
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
    const channel = supabase.channel('officer_stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => {
        toast.info("Data refreshed.");
        fetchLoanOfficers();
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const filteredOfficers = officers.filter(o =>
    o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.branch_name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);

  // Mobile-optimized columns with horizontal scrolling container
  const columns = (currentUserRole: typeof userRole) => [
    { 
      header: 'Officer', 
      cell: (row: LoanOfficer) => (
        <div className="min-w-[160px]">
          <Link to={`/loan-officer/${row.id}`} className="font-medium text-primary hover:underline">{row.name}</Link>
          <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
            <Mail className="h-4 w-4" />
            <span className="truncate max-w-[120px]">{row.email}</span>
          </div>
        </div>
      ) 
    },
    { 
      header: 'Branch', 
      cell: (row: LoanOfficer) => (
        <div className="min-w-[120px]">{row.branch_name}</div>
      )
    },
    { 
      header: 'Portfolio', 
      cell: (row: LoanOfficer) => (
        <div className="min-w-[100px]">
          <div className="font-medium">{row.active_loans}/{row.total_loans}</div>
          <div className="text-sm text-muted-foreground">{row.pending_loans} pending</div>
        </div>
      )
    },
    { 
      header: 'Balance', 
      cell: (row: LoanOfficer) => (
        <div className="min-w-[140px] text-right">
          <div className="font-mono">{formatCurrency(row.total_balance)}</div>
          <div className="text-sm text-muted-foreground">Outstanding</div>
        </div>
      )
    },
    { 
      header: 'Performance', 
      cell: (row: LoanOfficer) => (
        <div className="min-w-[100px] text-right">
          <div className="text-green-600">{row.completed_loans} Complete</div>
          <div className={`text-sm ${row.defaulted_loans > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
            {row.defaulted_loans} Defaulted
          </div>
        </div>
      )
    },
    { 
      header: 'Actions', 
      cell: (row: LoanOfficer) => (
        <div className="min-w-[60px] text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={`/loan-officer/${row.id}`}>
                  <Eye className="h-4 w-4 mr-2" /> View Profile
                </Link>
              </DropdownMenuItem>
              {currentUserRole === 'super_admin' && (
                <DropdownMenuItem asChild>
                  <Link to={`/users/${row.id}/edit`}>
                    <Edit className="h-4 w-4 mr-2" /> Edit User
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    },
  ];

  const totalOutstanding = officers.reduce((sum, o) => sum + (o.total_balance || 0), 0);
  const totalDisbursed = officers.reduce((sum, o) => sum + (o.total_disbursed || 0), 0);
  const activeOfficers = officers.filter(o => o.status === 'active').length;

  if (loading) { 
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    ); 
  }

  return (
    <div className="space-y-4 p-3 sm:p-6">
      {/* Header Section - Mobile Optimized */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Loan Officer Dashboard</h1>
          <p className="text-muted-foreground">Manage and monitor officer performance</p>
        </div>
        
        {/* Action Buttons - Mobile Optimized */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => fetchLoanOfficers()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <ExportDropdown 
            data={filteredOfficers} 
            columns={columns(userRole).slice(0, -1)} 
            fileName="loan_officer_report" 
            reportTitle="Loan Officer Performance Report"
          />
          {userRole === 'super_admin' && (
            <Button asChild>
              <Link to="/users">
                <UserCheck className="h-4 w-4 mr-2" /> Manage Users
              </Link>
            </Button>
          )}
        </div>
      </div>
      
      {/* Stats Grid - Mobile Optimized */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Total Officers" value={officers.length} icon={Users} />
        <StatCard title="Active Officers" value={activeOfficers} icon={UserCheck} />
        <StatCard title="Total Disbursed" value={formatCurrency(totalDisbursed)} icon={Landmark} />
        <StatCard title="Total Outstanding" value={formatCurrency(totalOutstanding)} icon={TrendingUp} />
      </div>
      
      {/* Data Table Card - Mobile Optimized with Proper Scroll Container */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Officer Directory</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search officers..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Properly contained horizontal scroll */}
          <div className="w-full overflow-x-auto">
            <div className="min-w-[780px] w-full">
              <DataTable 
                columns={columns(userRole)} 
                data={filteredOfficers} 
                emptyStateMessage="No loan officers found for your role."
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Mobile-Optimized StatCard Component
const StatCard: React.FC<{ title: string; value: string | number; icon: React.ElementType }> = ({ title, value, icon: Icon }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-xl sm:text-2xl font-bold truncate" title={value.toString()}>
        {typeof value === 'string' && value.length > 12 ? `${value.substring(0, 10)}...` : value}
      </div>
    </CardContent>
  </Card>
);

export default LoanOfficerPage;