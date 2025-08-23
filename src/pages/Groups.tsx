import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Users, 
  CreditCard, 
  DollarSign, 
  Loader2, 
  ShieldAlert,
  TrendingUp,
  BarChart3,
  PieChart,
  Eye,
  UserCheck,
  Building,
  Activity,
  RefreshCw,
  Filter
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table';
import { ExportDropdown } from '@/components/ui/ExportDropdown';

// --- Type Definitions ---
interface Group {
  id: number;
  name: string;
  description: string;
  branch_id: number;
  branch_name: string;
  created_at: string;
  member_count: number;
  active_members: number;
  loan_count: number;
  active_loans: number;
  total_outstanding: number;
  total_portfolio: number;
  avg_loan_size: number;
  avg_member_age: number;
  total_loan_officers: number;
  last_activity: string;
  group_health_score: number;
}

interface GroupMember {
  id: string;
  full_name: string;
  id_number: string;
  phone_number: string;
  status: string;
  assigned_officer_id: string;
  loan_officer_name: string;
  total_loans: number;
  active_loans: number;
  total_outstanding: number;
  last_loan_date: string;
  member_since: string;
  monthly_income: number;
  profession: string;
  address: string;
}

interface GroupLoanOfficer {
  officer_id: string;
  full_name: string;
  email: string;
  phone_number: string;
  assigned_members: number;
  active_loans: number;
  total_portfolio: number;
  avg_loan_size: number;
  last_activity: string;
}

interface GroupPerformance {
  group_id: number;
  group_name: string;
  branch_name: string;
  member_growth_rate: number;
  loan_growth_rate: number;
  portfolio_growth_rate: number;
  repayment_rate: number;
  efficiency_score: number;
  risk_score: number;
}

interface GroupStats {
  total_groups: number;
  total_members: number;
  total_loans: number;
  total_portfolio: number;
  avg_members_per_group: number;
  avg_loans_per_group: number;
}

const Groups: React.FC = () => {
  const { userRole, profile } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [performanceData, setPerformanceData] = useState<GroupPerformance[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [groupLoanOfficers, setGroupLoanOfficers] = useState<GroupLoanOfficer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Group | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', branch_id: '' });
  const [activeTab, setActiveTab] = useState('overview');
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    if (userRole === 'super_admin' || userRole === 'branch_manager') {
      fetchGroups();
      fetchBranches();
    } else {
      setLoading(false);
    }
  }, [userRole, profile]);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      let { data, error } = await supabase.rpc('get_group_comprehensive_stats' as any);
      
      if (error) {
        console.warn('RPC function not available, falling back to direct queries:', error);
        data = await fetchGroupsDirect();
      }
      
      if (data) {
        setGroups(data as Group[]);
        await fetchPerformanceData();
      }
    } catch (error: any) {
      console.error('Error fetching groups:', error);
      toast.error('Failed to load groups', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupsDirect = async (): Promise<Group[]> => {
    try {
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('id, name, branch_id, created_at')
        .order('name');
      
      if (groupsError) throw groupsError;

      const { data: memberStats, error: memberError } = await supabase
        .from('members')
        .select('group_id, status')
        .eq('status', 'active');
      
      if (memberError) throw memberError;

      const { data: loanStats, error: loanError } = await supabase
        .from('loans')
        .select('group_id, status, current_balance, principal_amount');
      
      if (loanError) throw loanError;

      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name');
      
      if (branchesError) throw branchesError;

      return (groupsData || []).map(group => {
        const memberCount = (memberStats || []).filter(m => m.group_id === group.id).length;
        const branchLoans = (loanStats || []).filter(l => l.group_id === group.id);
        const activeLoans = branchLoans.filter(l => l.status === 'active');
        const totalOutstanding = activeLoans.reduce((sum, l) => sum + parseFloat(l.current_balance || '0'), 0);
        const totalPortfolio = branchLoans.reduce((sum, l) => sum + parseFloat(l.principal_amount || '0'), 0);
        const avgLoanSize = branchLoans.length > 0 ? totalPortfolio / branchLoans.length : 0;
        const branchName = (branchesData || []).find(b => b.id === group.branch_id)?.name || 'Unknown Branch';

        return {
          id: group.id,
          name: group.name || '',
          description: '',
          branch_id: group.branch_id,
          branch_name: branchName,
          created_at: group.created_at,
          member_count: memberCount,
          active_members: memberCount,
          loan_count: activeLoans.length,
          active_loans: activeLoans.length,
          total_outstanding: totalOutstanding,
          total_portfolio: totalPortfolio,
          avg_loan_size: avgLoanSize,
          avg_member_age: 0,
          total_loan_officers: 0,
          last_activity: group.created_at,
          group_health_score: totalPortfolio > 0 ? ((totalPortfolio - totalOutstanding) / totalPortfolio) * 100 : 0
        };
      });
    } catch (error) {
      console.error('Error in direct fetch:', error);
      return [];
    }
  };

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .order('name');
      
      if (!error && data) {
        setBranches(data);
      }
    } catch (error) {
      console.warn('Could not fetch branches:', error);
    }
  };

  const fetchPerformanceData = async () => {
    try {
      const { data, error } = await supabase.rpc('get_group_performance_metrics' as any);
      if (!error && data) {
        setPerformanceData(data as GroupPerformance[]);
      }
    } catch (error) {
      console.warn('Could not fetch performance data:', error);
    }
  };

  const fetchGroupDetails = async (group: Group) => {
    setSelectedGroup(group);
    setActiveTab('details');
    try {
      const { data: members, error: membersError } = await supabase.rpc('get_group_members_detailed' as any, { group_id_param: group.id });
      if (!membersError && members) {
        setGroupMembers(members as GroupMember[]);
      } else {
        setGroupMembers([]);
      }

      const { data: officers, error: officersError } = await supabase.rpc('get_group_loan_officers' as any, { group_id_param: group.id });
      if (!officersError && officers) {
        setGroupLoanOfficers(officers as GroupLoanOfficer[]);
      } else {
        setGroupLoanOfficers([]);
      }
    } catch (error) {
      console.warn('Could not fetch group details:', error);
      toast.error('Failed to load group details');
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const submitData = {
        name: formData.name,
        description: formData.description,
        branch_id: formData.branch_id ? parseInt(formData.branch_id) : null
      };

      if (editingGroup) {
        const { error } = await supabase
          .from('groups')
          .update(submitData)
          .eq('id', editingGroup.id);
        if (error) throw error;
        toast.success(`Group "${formData.name}" updated successfully.`);
      } else {
        const { error } = await supabase
          .from('groups')
          .insert(submitData);
        if (error) throw error;
        toast.success(`Group "${formData.name}" created successfully.`);
      }
      closeDialog();
      await fetchGroups();
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
        .from('groups')
        .delete()
        .eq('id', deleteCandidate.id);
      if (error) throw error;
      toast.success(`Group "${deleteCandidate.name}" deleted successfully.`);
      setDeleteCandidate(null);
      await fetchGroups();
    } catch (error: any) {
      toast.error("Deletion failed", { 
        description: "You may need to reassign or delete members from this group first." 
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const openDialog = (group: Group | null = null) => {
    setEditingGroup(group);
    setFormData(group ? { 
      name: group.name, 
      description: group.description, 
      branch_id: group.branch_id?.toString() || '' 
    } : { name: '', description: '', branch_id: '' });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingGroup(null);
    setFormData({ name: '', description: '', branch_id: '' });
  };

  const filteredGroups = groups.filter(group =>
    (group.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (group.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (group.branch_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupStats: GroupStats = React.useMemo(() => {
    const totalGroups = groups.length;
    const totalMembers = groups.reduce((sum, g) => sum + (g.member_count || 0), 0);
    const totalLoans = groups.reduce((sum, g) => sum + (g.total_portfolio || 0), 0);
    const totalPortfolio = groups.reduce((sum, g) => sum + (g.total_portfolio || 0), 0);

    return {
      total_groups: totalGroups,
      total_members: totalMembers,
      total_loans: totalLoans,
      total_portfolio: totalPortfolio,
      avg_members_per_group: totalGroups > 0 ? Math.round(totalMembers / totalGroups) : 0,
      avg_loans_per_group: totalGroups > 0 ? Math.round(totalLoans / totalGroups) : 0
    };
  }, [groups]);

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { 
    style: 'currency', 
    currency: 'KES' 
  }).format(amount || 0);

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();

  const getHealthScoreBadge = (score: number) => {
    if (score >= 80) return <Badge variant="default">Excellent</Badge>;
    if (score >= 60) return <Badge variant="secondary">Good</Badge>;
    return <Badge variant="destructive">Poor</Badge>;
  };

  const columns = [
    { 
      header: 'Group', 
      cell: (row: Group) => (
        <div>
          <p className="font-medium">{row.name || 'Unnamed Group'}</p>
          <p className="text-xs text-muted-foreground">{row.description || 'No description'}</p>
        </div>
      ) 
    },
    { 
      header: 'Branch', 
      cell: (row: Group) => row.branch_name || 'Unknown Branch' 
    },
    { 
      header: 'Members', 
      cell: (row: Group) => (
        <div className="text-center">
          <Badge variant="secondary">{row.member_count || 0}</Badge>
        </div>
      ) 
    },
    { 
      header: 'Active Loans', 
      cell: (row: Group) => (
        <div className="text-center">
          <Badge variant="outline">{row.active_loans || 0}</Badge>
        </div>
      ) 
    },
    { 
      header: 'Portfolio', 
      cell: (row: Group) => (
        <div className="font-mono text-right">
          {formatCurrency(row.total_portfolio || 0)}
        </div>
      ) 
    },
    { 
      header: 'Health Score', 
      cell: (row: Group) => (
        <div className="text-center">
          {getHealthScoreBadge(row.group_health_score || 0)}
        </div>
      ) 
    },
    { 
      header: 'Actions', 
      cell: (row: Group) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="icon" onClick={() => fetchGroupDetails(row)}>
            <Eye className="h-4 w-4" />
          </Button>
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
    { header: 'Group Name', accessorKey: 'name' as keyof Group },
    { header: 'Description', accessorKey: 'description' as keyof Group },
    { header: 'Branch', accessorKey: 'branch_name' as keyof Group },
    { header: 'Member Count', accessorKey: 'member_count' as keyof Group },
    { header: 'Active Loans', accessorKey: 'active_loans' as keyof Group },
    { header: 'Total Portfolio', accessorKey: 'total_portfolio' as keyof Group },
    { header: 'Health Score', accessorKey: 'group_health_score' as keyof Group },
    { header: 'Created Date', accessorKey: 'created_at' as keyof Group }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (userRole !== 'super_admin' && userRole !== 'branch_manager') {
    return (
      <div className="p-2 sm:p-4 md:p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-yellow-500" />
            <CardTitle className="mt-4">Access Denied</CardTitle>
            <CardDescription>Only Super Admins and Branch Managers can manage groups.</CardDescription>
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
            <h1 className="text-3xl font-bold text-foreground">Group Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage member groups and monitor their performance metrics.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchGroups} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => openDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              New Group
            </Button>
          </div>
        </div>

        {/* Group Selection Dropdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Group Access</CardTitle>
            <CardDescription>
              Select a group to view its details and performance metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-center">
              <Select 
                value={selectedGroup?.id?.toString() || ''} 
                onValueChange={(value) => {
                  const group = groups.find(g => g.id.toString() === value);
                  if (group) {
                    fetchGroupDetails(group);
                  }
                }}
              >
                <SelectTrigger className="w-80">
                  <SelectValue placeholder="Select a group to view details..." />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(group => (
                    <SelectItem key={group.id} value={group.id.toString()}>
                      {group.name} - {group.branch_name} ({group.member_count} members)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedGroup && (
                <Button variant="outline" onClick={() => setSelectedGroup(null)}>
                  Clear Selection
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveTab('overview')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Total Groups
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{groupStats.total_groups}</div>
              <p className="text-xs text-muted-foreground">Active groups</p>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveTab('details')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-muted-foreground" />
                Total Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{groupStats.total_members}</div>
              <p className="text-xs text-muted-foreground">
                Avg: {groupStats.avg_members_per_group} per group
              </p>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveTab('performance')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                Total Loans
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{groupStats.total_loans}</div>
              <p className="text-xs text-muted-foreground">Across all groups</p>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveTab('analytics')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Total Portfolio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(groupStats.total_portfolio)}</div>
              <p className="text-xs text-muted-foreground">Group portfolios</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="details">Group Details</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Groups Overview</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search groups..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        className="pl-9" 
                      />
                    </div>
                    <ExportDropdown 
                      data={filteredGroups} 
                      columns={exportColumns} 
                      fileName="groups_report" 
                      reportTitle="Groups Report" 
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <DataTable 
                  columns={columns} 
                  data={filteredGroups} 
                  emptyStateMessage="No groups found matching your criteria." 
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
                  Group Performance Metrics
                </CardTitle>
                <CardDescription>
                  Performance comparison across all groups
                </CardDescription>
              </CardHeader>
              <CardContent>
                {performanceData.length > 0 ? (
                  <div className="space-y-4">
                    {performanceData.map((group) => (
                      <div key={group.group_id} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{group.group_name}</span>
                          <div className="flex gap-4 text-sm">
                            <span>Efficiency: <Badge variant={group.efficiency_score >= 80 ? 'default' : group.efficiency_score >= 60 ? 'secondary' : 'destructive'}>
                              {group.efficiency_score.toFixed(1)}%
                            </Badge></span>
                            <span>Risk: <Badge variant={group.risk_score <= 30 ? 'default' : group.risk_score <= 50 ? 'secondary' : 'destructive'}>
                              {group.risk_score.toFixed(1)}%
                            </Badge></span>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Members: </span>
                            <span className={group.member_growth_rate >= 80 ? 'text-green-600' : group.member_growth_rate >= 60 ? 'text-yellow-600' : 'text-red-600'}>
                              {group.member_growth_rate.toFixed(1)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Loans: </span>
                            <span className={group.loan_growth_rate >= 80 ? 'text-green-600' : group.loan_growth_rate >= 60 ? 'text-yellow-600' : 'text-red-600'}>
                              {group.loan_growth_rate.toFixed(1)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Portfolio: </span>
                            <span className={group.portfolio_growth_rate >= 80 ? 'text-green-600' : group.portfolio_growth_rate >= 60 ? 'text-yellow-600' : 'text-red-600'}>
                              {group.portfolio_growth_rate.toFixed(1)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Repayment: </span>
                            <span className={group.repayment_rate >= 80 ? 'text-green-600' : group.repayment_rate >= 60 ? 'text-yellow-600' : 'text-red-600'}>
                              {group.repayment_rate.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <Progress value={group.efficiency_score} className="h-2" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="mx-auto h-12 w-12 mb-4" />
                    <p>Performance data not available</p>
                    <p className="text-sm">This feature requires the performance metrics function to be deployed</p>
                    <Button 
                      className="mt-4" 
                      variant="outline" 
                      onClick={fetchPerformanceData}
                    >
                      Retry Loading Performance Data
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Member Distribution
                  </CardTitle>
                  <CardDescription>Members per group</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {groups.map(group => (
                      <div key={group.id} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{group.name}</span>
                          <span className="text-muted-foreground">
                            {group.member_count || 0} members
                          </span>
                        </div>
                        <Progress 
                          value={groupStats.total_members > 0 ? (group.member_count || 0) / groupStats.total_members * 100 : 0} 
                          className="h-2"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Portfolio Distribution
                  </CardTitle>
                  <CardDescription>Loan portfolio per group</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {groups.map(group => (
                      <div key={group.id} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{group.name}</span>
                          <span className="text-muted-foreground">
                            {formatCurrency(group.total_portfolio || 0)}
                          </span>
                        </div>
                        <Progress 
                          value={groupStats.total_portfolio > 0 ? (group.total_portfolio || 0) / groupStats.total_portfolio * 100 : 0} 
                          className="h-2"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Group Details Tab */}
          <TabsContent value="details" className="space-y-4">
            {selectedGroup ? (
              <div className="space-y-4">
                {/* Group Header */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      {selectedGroup.name}
                    </CardTitle>
                    <CardDescription>
                      {selectedGroup.description} • {selectedGroup.branch_name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{selectedGroup.member_count}</div>
                        <div className="text-sm text-muted-foreground">Members</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{selectedGroup.active_loans}</div>
                        <div className="text-sm text-muted-foreground">Active Loans</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">{formatCurrency(selectedGroup.total_portfolio)}</div>
                        <div className="text-sm text-muted-foreground">Portfolio</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{selectedGroup.total_loan_officers}</div>
                        <div className="text-sm text-muted-foreground">Loan Officers</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Group Members */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserCheck className="h-5 w-5" />
                      Group Members ({groupMembers.length})
                    </CardTitle>
                    <CardDescription>Click on a member to view their profile</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {groupMembers.map(member => (
                        <div 
                          key={member.id} 
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => window.open(`/members/${member.id}`, '_blank')}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <Users className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <div className="font-medium">{member.full_name}</div>
                              <div className="text-sm text-muted-foreground">
                                {member.id_number} • {member.phone_number}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {member.profession} • {formatCurrency(member.monthly_income || 0)}/month
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{formatCurrency(member.total_outstanding)}</div>
                            <div className="text-sm text-muted-foreground">
                              {member.active_loans} active loans
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Member since {formatDate(member.member_since)}
                            </div>
                          </div>
                        </div>
                      ))}
                      {groupMembers.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <Users className="mx-auto h-12 w-12 mb-4" />
                          <p>No members in this group</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Loan Officers */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Assigned Loan Officers ({groupLoanOfficers.length})
                    </CardTitle>
                    <CardDescription>Officers managing this group's loans and members</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {groupLoanOfficers.map(officer => (
                        <div key={officer.officer_id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                              <UserCheck className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                              <div className="font-medium">{officer.full_name}</div>
                              <div className="text-sm text-muted-foreground">
                                {officer.email} • {officer.phone_number}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Portfolio: {formatCurrency(officer.total_portfolio || 0)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{officer.assigned_members} members</div>
                            <div className="text-sm text-muted-foreground">
                              {officer.active_loans} active loans
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Avg: {formatCurrency(officer.avg_loan_size || 0)}
                            </div>
                          </div>
                        </div>
                      ))}
                      {groupLoanOfficers.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <Building className="mx-auto h-12 w-12 mb-4" />
                          <p>No loan officers assigned to this group</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-8 text-muted-foreground">
                  <Users className="mx-auto h-12 w-12 mb-4" />
                  <p>Select a group to view detailed information</p>
                  <p className="text-sm">Use the dropdown above or click the eye icon on any group in the overview tab</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create/Edit Group Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? 'Edit Group' : 'Create New Group'}
            </DialogTitle>
            <DialogDescription>
              {editingGroup 
                ? 'Update the details for this group.' 
                : 'Add a new group to organize members.'
              }
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4 pt-4">
            <div>
              <Label htmlFor="name">Group Name</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
                placeholder="e.g., Youth Group, Women's Group" 
                required 
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input 
                id="description" 
                value={formData.description} 
                onChange={(e) => setFormData({...formData, description: e.target.value})} 
                placeholder="Brief description of the group" 
              />
            </div>
            <div>
              <Label htmlFor="branch_id">Branch</Label>
              <Select value={formData.branch_id} onValueChange={(value) => setFormData({...formData, branch_id: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map(branch => (
                    <SelectItem key={branch.id} value={branch.id.toString()}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingGroup ? 'Save Changes' : 'Create Group'}
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
              Are you sure you want to delete the group: <strong>{deleteCandidate?.name}</strong>? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setDeleteCandidate(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Groups;