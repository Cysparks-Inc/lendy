import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Building, 
  Users, 
  CreditCard, 
  DollarSign, 
  Loader2, 
  AlertCircle, 
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Calendar,
  MapPin,
  Activity,
  RefreshCw,
  Filter,
  Download
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table';
import { ExportDropdown } from '@/components/ui/ExportDropdown';

// --- Type Definitions ---
interface Branch {
  id: number;
  name: string;
  location: string;
  created_at: string;
  member_count: number;
  loan_count: number;
  total_outstanding: number;
  total_loans: number;
  total_portfolio: number;
  avg_loan_size?: number;
  recovery_rate?: number;
  last_activity?: string;
}

interface BranchPerformance {
  branch_name: string;
  member_growth_rate: number;
  loan_growth_rate: number;
  portfolio_growth_rate: number;
  efficiency_score: number;
}

interface BranchStats {
  total_branches: number;
  total_members: number;
  total_loans: number;
  total_portfolio: number;
  avg_members_per_branch: number;
  avg_loans_per_branch: number;
}

const Branches: React.FC = () => {
  const { userRole } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [performanceData, setPerformanceData] = useState<BranchPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Branch | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({ name: '', location: '' });
  const [activeTab, setActiveTab] = useState('overview');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (userRole === 'super_admin') {
      fetchBranches();
    } else {
      setLoading(false);
    }
  }, [userRole]);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      // Try RPC function first
      let { data, error } = await supabase.rpc('get_branch_stats');
      
      if (error) {
        console.warn('RPC function not available, falling back to direct queries:', error);
        // Fallback to direct database queries
        data = await fetchBranchesDirect();
      }
      
      if (data) {
        setBranches(data);
        await fetchPerformanceData();
      }
    } catch (error: any) {
      console.error('Error fetching branches:', error);
      toast.error('Failed to load branches', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchBranchesDirect = async (): Promise<Branch[]> => {
    try {
      // Get basic branch data
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name, location, created_at')
        .order('name');
      
      if (branchesError) throw branchesError;

      // Get member counts
      const { data: memberStats, error: memberError } = await supabase
        .from('members')
        .select('branch_id, status')
        .eq('status', 'active');
      
      if (memberError) throw memberError;

      // Get loan statistics
      const { data: loanStats, error: loanError } = await supabase
        .from('loans')
        .select('branch_id, status, current_balance, principal_amount');
      
      if (loanError) throw loanError;

      // Process and combine data
      return (branchesData || []).map(branch => {
        const memberCount = (memberStats || []).filter(m => m.branch_id === branch.id).length;
        const branchLoans = (loanStats || []).filter(l => l.branch_id === branch.id);
        const activeLoans = branchLoans.filter(l => l.status === 'active');
        const totalOutstanding = activeLoans.reduce((sum, l) => sum + parseFloat(l.current_balance || '0'), 0);
        const totalPortfolio = branchLoans.reduce((sum, l) => sum + parseFloat(l.principal_amount || '0'), 0);
        const avgLoanSize = branchLoans.length > 0 ? totalPortfolio / branchLoans.length : 0;

        return {
          id: branch.id,
          name: branch.name || '',
          location: branch.location || '',
          created_at: branch.created_at,
          member_count: memberCount,
          loan_count: activeLoans.length,
          total_outstanding: totalOutstanding,
          total_loans: branchLoans.length,
          total_portfolio: totalPortfolio,
          avg_loan_size: avgLoanSize,
          recovery_rate: totalPortfolio > 0 ? ((totalPortfolio - totalOutstanding) / totalPortfolio) * 100 : 0
        };
      });
    } catch (error) {
      console.error('Error in direct fetch:', error);
      return [];
    }
  };

  const fetchPerformanceData = async () => {
    try {
      const { data, error } = await supabase.rpc('get_branch_performance_comparison');
      if (!error && data) {
        setPerformanceData(data);
      }
    } catch (error) {
      console.warn('Could not fetch performance data:', error);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingBranch) {
        const { error } = await supabase
          .from('branches')
          .update(formData)
          .eq('id', editingBranch.id);
        if (error) throw error;
        toast.success(`Branch "${formData.name}" updated successfully.`);
      } else {
        const { error } = await supabase
          .from('branches')
          .insert(formData);
        if (error) throw error;
        toast.success(`Branch "${formData.name}" created successfully.`);
      }
      closeDialog();
      await fetchBranches();
    } catch (error: any) {
      toast.error(`Operation failed`, { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', deleteCandidate.id);
      if (error) throw error;
      toast.success(`Branch "${deleteCandidate.name}" deleted successfully.`);
      setDeleteCandidate(null);
      await fetchBranches();
    } catch (error: any) {
      toast.error("Deletion failed", { 
        description: "You may need to reassign or delete members and loans from this branch first." 
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const openDialog = (branch: Branch | null = null) => {
    setEditingBranch(branch);
    setFormData(branch ? { name: branch.name, location: branch.location } : { name: '', location: '' });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingBranch(null);
    setFormData({ name: '', location: '' });
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const filteredAndSortedBranches = React.useMemo(() => {
    let filtered = branches.filter(branch =>
      (branch.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (branch.location || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort the filtered results
    filtered.sort((a, b) => {
      let aValue: any = a[sortBy as keyof Branch];
      let bValue: any = b[sortBy as keyof Branch];

      // Handle null/undefined values
      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [branches, searchTerm, sortBy, sortOrder]);

  const branchStats: BranchStats = React.useMemo(() => {
    const totalBranches = branches.length;
    const totalMembers = branches.reduce((sum, b) => sum + (b.member_count || 0), 0);
    const totalLoans = branches.reduce((sum, b) => sum + (b.total_loans || 0), 0);
    const totalPortfolio = branches.reduce((sum, b) => sum + (b.total_portfolio || 0), 0);

    return {
      total_branches: totalBranches,
      total_members: totalMembers,
      total_loans: totalLoans,
      total_portfolio: totalPortfolio,
      avg_members_per_branch: totalBranches > 0 ? Math.round(totalMembers / totalBranches) : 0,
      avg_loans_per_branch: totalBranches > 0 ? Math.round(totalLoans / totalBranches) : 0
    };
  }, [branches]);

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { 
    style: 'currency', 
    currency: 'KES' 
  }).format(amount || 0);

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();

  const getPerformanceColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const columns = [
    { 
      header: 'Branch', 
      cell: (row: Branch) => (
        <div>
          <p className="font-medium">{row.name || 'Unnamed Branch'}</p>
          <p className="text-xs text-muted-foreground">ID: {row.id}</p>
        </div>
      ) 
    },
    { 
      header: 'Location', 
      cell: (row: Branch) => row.location || 'N/A' 
    },
    { 
      header: 'Members', 
      cell: (row: Branch) => (
        <div className="text-center">
          <Badge variant="secondary">{row.member_count || 0}</Badge>
        </div>
      ) 
    },
    { 
      header: 'Active Loans', 
      cell: (row: Branch) => (
        <div className="text-center">
          <Badge variant="outline">{row.loan_count || 0}</Badge>
        </div>
      ) 
    },
    { 
      header: 'Total Outstanding', 
      cell: (row: Branch) => (
        <div className="font-mono text-right text-destructive">
          {formatCurrency(row.total_outstanding || 0)}
        </div>
      ) 
    },
    { 
      header: 'Portfolio', 
      cell: (row: Branch) => (
        <div className="font-mono text-right">
          {formatCurrency(row.total_portfolio || 0)}
        </div>
      ) 
    },
    { 
      header: 'Actions', 
      cell: (row: Branch) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="icon" onClick={() => openDialog(row)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="destructive" size="icon" onClick={() => setDeleteCandidate(row)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    },
  ];

  const exportColumns = [
    { header: 'Branch Name', accessorKey: 'name' },
    { header: 'Location', accessorKey: 'location' },
    { header: 'Member Count', accessorKey: 'member_count' },
    { header: 'Active Loans', accessorKey: 'loan_count' },
    { header: 'Total Outstanding', accessorKey: 'total_outstanding' },
    { header: 'Total Portfolio', accessorKey: 'total_portfolio' },
    { header: 'Created Date', accessorKey: 'created_at' }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (userRole !== 'super_admin') {
    return (
      <div className="p-2 sm:p-4 md:p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-yellow-500" />
            <CardTitle className="mt-4">Access Denied</CardTitle>
            <CardDescription>Only Super Admins can manage branches.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 p-2 sm:p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Branch Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage branch locations and monitor their performance metrics.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchBranches} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => openDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              New Branch
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                Total Branches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{branchStats.total_branches}</div>
              <p className="text-xs text-muted-foreground">
                Active locations
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Total Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{branchStats.total_members}</div>
              <p className="text-xs text-muted-foreground">
                Avg: {branchStats.avg_members_per_branch} per branch
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                Total Loans
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{branchStats.total_loans}</div>
              <p className="text-xs text-muted-foreground">
                Avg: {branchStats.avg_loans_per_branch} per branch
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Total Portfolio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(branchStats.total_portfolio)}</div>
              <p className="text-xs text-muted-foreground">
                Across all branches
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Branch Overview</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search branches..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        className="pl-9" 
                      />
                    </div>
                    <ExportDropdown 
                      data={filteredAndSortedBranches} 
                      columns={exportColumns} 
                      fileName="branches_report" 
                      reportTitle="Branches Report" 
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <DataTable 
                  columns={columns} 
                  data={filteredAndSortedBranches} 
                  emptyStateMessage="No branches found matching your criteria." 
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Branch Performance Comparison
                </CardTitle>
                <CardDescription>
                  Performance metrics across all branches
                </CardDescription>
              </CardHeader>
              <CardContent>
                {performanceData.length > 0 ? (
                  <div className="space-y-4">
                    {performanceData.map((branch, index) => (
                      <div key={branch.branch_name} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{branch.branch_name}</span>
                          <div className="flex gap-4 text-sm">
                            <span>Efficiency: <Badge variant={branch.efficiency_score >= 80 ? 'default' : branch.efficiency_score >= 60 ? 'secondary' : 'destructive'}>
                              {branch.efficiency_score.toFixed(1)}%
                            </Badge></span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Members: </span>
                            <span className={getPerformanceColor(branch.member_growth_rate)}>
                              {branch.member_growth_rate.toFixed(1)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Loans: </span>
                            <span className={getPerformanceColor(branch.loan_growth_rate)}>
                              {branch.loan_growth_rate.toFixed(1)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Portfolio: </span>
                            <span className={getPerformanceColor(branch.portfolio_growth_rate)}>
                              {branch.portfolio_growth_rate.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <Progress value={branch.efficiency_score} className="h-2" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="mx-auto h-12 w-12 mb-4" />
                    <p>Performance data not available</p>
                    <p className="text-sm">This feature requires the performance comparison function</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              {/* Branch Distribution Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Member Distribution
                  </CardTitle>
                  <CardDescription>
                    Members per branch
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {branches.map(branch => (
                      <div key={branch.id} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{branch.name}</span>
                          <span className="text-muted-foreground">
                            {branch.member_count || 0} members
                          </span>
                        </div>
                        <Progress 
                          value={branchStats.total_members > 0 ? (branch.member_count || 0) / branchStats.total_members * 100 : 0} 
                          className="h-2"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Portfolio Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Portfolio Distribution
                  </CardTitle>
                  <CardDescription>
                    Loan portfolio per branch
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {branches.map(branch => (
                      <div key={branch.id} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{branch.name}</span>
                          <span className="text-muted-foreground">
                            {formatCurrency(branch.total_portfolio || 0)}
                          </span>
                        </div>
                        <Progress 
                          value={branchStats.total_portfolio > 0 ? (branch.total_portfolio || 0) / branchStats.total_portfolio * 100 : 0} 
                          className="h-2"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create/Edit Branch Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBranch ? 'Edit Branch' : 'Create New Branch'}
            </DialogTitle>
            <DialogDescription>
              {editingBranch 
                ? 'Update the details for this branch.' 
                : 'Add a new branch location to the system.'
              }
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4 pt-4">
            <div>
              <Label htmlFor="name">Branch Name</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
                placeholder="e.g., Nairobi Central" 
                required 
              />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input 
                id="location" 
                value={formData.location} 
                onChange={(e) => setFormData({...formData, location: e.target.value})} 
                placeholder="e.g., CBD, Nairobi" 
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingBranch ? 'Save Changes' : 'Create Branch'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteCandidate} onOpenChange={() => setDeleteCandidate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the branch: <strong>{deleteCandidate?.name}</strong>? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setDeleteCandidate(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Branches;