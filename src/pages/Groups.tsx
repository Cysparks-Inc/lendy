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
  Filter,
  UserPlus,
  X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table';
import { ExportDropdown } from '@/components/ui/ExportDropdown';
import { PageLoader, InlineLoader, ButtonLoader } from '@/components/ui/loader';
import { Link } from 'react-router-dom';

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

interface AvailableMember {
  id: string;
  full_name: string;
  id_number: string;
  phone_number: string;
  branch_name: string;
  status: string;
  current_group_id: number | null;
  current_group_name: string | null;
}

const Groups: React.FC = () => {
  const { userRole, profile } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
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
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  
  // New state for managing group members
  const [manageMembersDialogOpen, setManageMembersDialogOpen] = useState(false);
  const [availableMembers, setAvailableMembers] = useState<AvailableMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isManagingMembers, setIsManagingMembers] = useState(false);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');

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
      // Try RPC function first, but handle type mismatches gracefully
      let { data, error } = await supabase.rpc('get_group_comprehensive_stats' as any);
      
      if (error) {
        console.warn('RPC function failed, falling back to direct queries:', error);
        data = await fetchGroupsDirect();
      } else if (data) {
        // Convert bigint to number if needed
        data = data.map((group: any) => ({
          ...group,
          id: Number(group.id),
          member_count: Number(group.member_count || 0),
          active_loans: Number(group.active_loans || 0),
          total_portfolio: Number(group.total_portfolio || 0),
          total_outstanding: Number(group.total_outstanding || 0),
          avg_loan_size: Number(group.avg_loan_size || 0)
        }));
        setGroups(data as Group[]);
      }
      
      if (data) {
        setGroups(data as Group[]);
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
      console.log('Fetching groups data...');
      
      // First, let's check what groups exist
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('id, name, branch_id, created_at')
        .order('name');
      
      if (groupsError) throw groupsError;
      console.log('Groups data:', groupsData);

      if (!groupsData || groupsData.length === 0) {
        console.log('No groups found in database');
        return [];
      }

      // Get all active members with their group assignments
      const { data: memberStats, error: memberError } = await supabase
        .from('members')
        .select('group_id, status')
        .eq('status', 'active');
      
      if (memberError) throw memberError;
      console.log('Member stats:', memberStats);

      // Get all loans with group information - check what columns actually exist
      const { data: loanStats, error: loanError } = await supabase
        .from('loans')
        .select('*')
        .limit(10); // Just get a sample to see the structure
      
      if (loanError) throw loanError;
      console.log('Loan stats sample:', loanStats);

      // Get branch information
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name');
      
      if (branchesError) throw branchesError;
      console.log('Branches data:', branchesData);

      return (groupsData || []).map(group => {
        const groupId = Number(group.id);
        console.log(`Processing group ${group.name} with ID ${groupId}`);
        
        // Count members in this group
        const memberCount = (memberStats || []).filter(m => Number(m.group_id) === groupId).length;
        console.log(`Group ${group.name} has ${memberCount} members`);
        
        // For now, let's just check what loans exist and their structure
        console.log(`Available loan columns:`, loanStats && loanStats.length > 0 ? Object.keys(loanStats[0]) : 'No loans found');
        
        // Get loans for this group - try to find the right linking column
        let groupLoans: any[] = [];
        
        if (loanStats && loanStats.length > 0) {
          // Check if loans have group_id directly
          if (loanStats[0].hasOwnProperty('group_id')) {
            groupLoans = loanStats.filter(l => Number(l.group_id) === groupId);
            console.log(`Direct group loans for ${group.name}:`, groupLoans);
          }
          // If no direct group_id, we'll need to link through members later
        }
        
        // Debug: Let's see ALL loans for this group regardless of status
        console.log(`All loans for group ${group.name}:`, groupLoans);
        console.log(`Loan statuses for group ${group.name}:`, groupLoans.map(l => ({ id: l.id, status: l.status, amount: l.principal_amount })));
        
        // Check what statuses exist in the database
        const allStatuses = [...new Set(groupLoans.map(l => l.status))];
        console.log(`Available loan statuses for group ${group.name}:`, allStatuses);
        
        // Try different status filters to see what we get
        const pendingLoans = groupLoans.filter(l => l.status === 'pending');
        const activeLoans = groupLoans.filter(l => l.status === 'active');
        const allNonRepaidLoans = groupLoans.filter(l => l.status !== 'repaid');
        
        console.log(`Pending loans: ${pendingLoans.length}, Active loans: ${activeLoans.length}, All non-repaid: ${allNonRepaidLoans.length}`);
        
        // Use a more inclusive filter - consider pending loans as "active" for portfolio purposes
        const effectiveActiveLoans = allNonRepaidLoans.length > 0 ? allNonRepaidLoans : activeLoans;
        
        const totalOutstanding = effectiveActiveLoans.reduce((sum, l) => sum + parseFloat(l.current_balance || '0'), 0);
        const totalPortfolio = groupLoans.reduce((sum, l) => sum + parseFloat(l.principal_amount || '0'), 0);
        const avgLoanSize = groupLoans.length > 0 ? totalPortfolio / groupLoans.length : 0;
        const branchName = (branchesData || []).find(b => b.id === group.branch_id)?.name || 'Unknown Branch';

        console.log(`Group ${group.name}: ${effectiveActiveLoans.length} effective active loans, portfolio: ${totalPortfolio}, outstanding: ${totalOutstanding}`);
        console.log(`Group ${group.name}: Total loans found: ${groupLoans.length}`);

        return {
          id: groupId,
          name: group.name || '',
          description: '',
          branch_id: group.branch_id,
          branch_name: branchName,
          created_at: group.created_at,
          member_count: memberCount,
          active_members: memberCount,
          loan_count: effectiveActiveLoans.length,
          active_loans: effectiveActiveLoans.length,
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

  const fetchGroupDetails = async (group: Group) => {
    setSelectedGroup(group);
    try {
      console.log(`Fetching details for group: ${group.name} (ID: ${group.id})`);
      
      // Fetch group members with enhanced information including loan officers
      const { data: members, error: membersError } = await supabase
        .from('members')
        .select(`
          id,
          full_name,
          id_number,
          phone_number,
          status,
          address,
          created_at
        `)
        .eq('group_id', group.id)
        .eq('status', 'active')
        .order('full_name');

      if (membersError) {
        console.error('Error fetching members:', membersError);
        toast.error('Failed to fetch group members');
        setGroupMembers([]);
      } else {
        console.log('Members data:', members);
        
        // Transform to match GroupMember interface
        const transformedMembers = (members || []).map(member => ({
          id: member.id,
          full_name: member.full_name,
          id_number: member.id_number,
          phone_number: member.phone_number,
          status: member.status || 'active',
          assigned_officer_id: '', // Not available in current schema
          loan_officer_name: 'Not Assigned', // Not available in current schema
          total_loans: 0,
          active_loans: 0,
          total_outstanding: 0,
          last_loan_date: '',
          member_since: member.created_at,
          monthly_income: 0, // Not available in current schema
          profession: 'Not Specified', // Not available in current schema
          address: member.address || ''
        }));
        setGroupMembers(transformedMembers);
        console.log(`Transformed ${transformedMembers.length} members for group ${group.name}`);
        console.log('Member details:', transformedMembers);
      }

      // For now, we'll set loan officers to empty since we don't have that data
      setGroupLoanOfficers([]);
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

  // New functions for managing group members
  const openManageMembersDialog = async (group: Group) => {
    setSelectedGroup(group);
    setManageMembersDialogOpen(true);
    setSelectedMembers([]);
    setMemberSearchTerm('');
    await fetchAvailableMembers(group);
  };

  const closeManageMembersDialog = () => {
    setManageMembersDialogOpen(false);
    setSelectedGroup(null);
    setAvailableMembers([]);
    setSelectedMembers([]);
    setMemberSearchTerm('');
  };

  const fetchAvailableMembers = async (group: Group) => {
    try {
      console.log(`Fetching available members for group: ${group.name}`);
      
      // Get all active members that are either not assigned to any group or assigned to a different group
      const { data: members, error } = await supabase
        .from('members')
        .select(`
          id,
          full_name,
          id_number,
          phone_number,
          status,
          branch_id,
          group_id,
          created_at
        `)
        .eq('status', 'active')
        .or(`group_id.is.null,group_id.neq.${group.id}`);

      if (error) {
        console.error('Error fetching available members:', error);
        toast.error('Failed to fetch available members');
        setAvailableMembers([]);
        return;
      }

      console.log('Available members data:', members);

      // Get branch names for the members
      const branchIds = [...new Set(members?.map(m => m.branch_id).filter(Boolean) || [])];
      let branches: { id: number; name: string }[] = [];
      
      if (branchIds.length > 0) {
        const { data: branchData, error: branchError } = await supabase
          .from('branches')
          .select('id, name')
          .in('id', branchIds);
        
        if (!branchError && branchData) {
          branches = branchData;
        }
      }

      // Get current group names for members who are already in groups
      const groupIds = [...new Set(members?.map(m => m.group_id).filter(Boolean) || [])];
      let groups: { id: number; name: string }[] = [];
      
      if (groupIds.length > 0) {
        const { data: groupData, error: groupError } = await supabase
          .from('groups')
          .select('id, name')
          .in('id', groupIds);
        
        if (!groupError && groupData) {
          groups = groupData;
        }
      }

      // Transform to AvailableMember interface
      const transformedMembers = (members || []).map(member => ({
        id: member.id,
        full_name: member.full_name,
        id_number: member.id_number,
        phone_number: member.phone_number,
        branch_name: branches.find(b => b.id === member.branch_id)?.name || 'Unknown Branch',
        status: member.status || 'active',
        current_group_id: member.group_id,
        current_group_name: member.group_id ? groups.find(g => g.id === member.group_id)?.name || 'Unknown Group' : null
      }));

      setAvailableMembers(transformedMembers);
      console.log(`Transformed ${transformedMembers.length} available members`);
    } catch (error) {
      console.error('Error in fetchAvailableMembers:', error);
      toast.error('Failed to fetch available members');
    }
  };

  const handleAddMembersToGroup = async () => {
    if (!selectedGroup || selectedMembers.length === 0) return;

    setIsManagingMembers(true);
    try {
      // Update the group_id for selected members
      const { error } = await supabase
        .from('members')
        .update({ group_id: selectedGroup.id })
        .in('id', selectedMembers);

      if (error) throw error;

      toast.success(`Successfully added ${selectedMembers.length} member(s) to ${selectedGroup.name}`);
      
      // Refresh the groups list to update member counts
      await fetchGroups();
      
      // Refresh the group details and available members
      await fetchGroupDetails(selectedGroup);
      await fetchAvailableMembers(selectedGroup);
      setSelectedMembers([]);
      
    } catch (error: any) {
      console.error('Error adding members to group:', error);
      toast.error('Failed to add members to group', { description: error.message });
    } finally {
      setIsManagingMembers(false);
    }
  };

  const handleRemoveMemberFromGroup = async (memberId: string) => {
    if (!selectedGroup) return;

    try {
      const { error } = await supabase
        .from('members')
        .update({ group_id: null })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Member removed from group successfully');
      
      // Refresh the groups list to update member counts
      await fetchGroups();
      
      // Refresh the group details and available members
      await fetchGroupDetails(selectedGroup);
      await fetchAvailableMembers(selectedGroup);
      
    } catch (error: any) {
      console.error('Error removing member from group:', error);
      toast.error('Failed to remove member from group', { description: error.message });
    }
  };

  const filteredAvailableMembers = availableMembers.filter(member =>
    member.full_name.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
    member.id_number.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
    member.phone_number.includes(memberSearchTerm) ||
    member.branch_name.toLowerCase().includes(memberSearchTerm.toLowerCase())
  );

  const handleMemberSelection = (memberId: string) => {
    if (selectedMembers.includes(memberId)) {
      setSelectedMembers(selectedMembers.filter(id => id !== memberId));
    } else {
      setSelectedMembers([...selectedMembers, memberId]);
    }
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

  const handleDeleteGroup = async (groupId: number) => {
    const group = groups.find(g => g.id === groupId);
    if (group) {
      setDeleteCandidate(group);
      setDialogOpen(true); // Reusing dialog for confirmation
    }
  };

  const columns = [
    { 
      header: 'Group', 
      cell: (row: Group) => (
        <div>
          <div className="text-body font-medium">{row.name}</div>
          <div className="text-caption text-muted-foreground">{row.description}</div>
        </div>
      ) 
    },
    { 
      header: 'Branch', 
      cell: (row: Group) => (
        <div className="text-body">{row.branch_name}</div>
      ) 
    },
    { 
      header: 'Members', 
      cell: (row: Group) => (
        <div className="text-center">
          <div className="text-body font-medium">{row.member_count}</div>
          <div className="text-caption text-muted-foreground">Active: {row.active_members}</div>
        </div>
      ) 
    },
    { 
      header: 'Loans', 
      cell: (row: Group) => (
        <div className="text-center">
          <div className="text-body font-medium">{row.loan_count}</div>
          <div className="text-caption text-muted-foreground">Active: {row.active_loans}</div>
        </div>
      ) 
    },
    { 
      header: 'Portfolio', 
      cell: (row: Group) => (
        <div className="text-right">
          <div className="text-body font-medium">{formatCurrency(row.total_portfolio)}</div>
          <div className="text-caption text-muted-foreground">Outstanding: {formatCurrency(row.total_outstanding)}</div>
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
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/groups/${row.id}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDeleteGroup(row.id)}
            className="text-destructive hover:text-destructive"
          >
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
    return <PageLoader text="Loading groups..." />;
  }

  if (userRole !== 'super_admin' && userRole !== 'branch_manager') {
    return (
      <div className="p-2 sm:p-4 md:p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-yellow-500" />
            <CardTitle className="text-heading-3 mt-4">Access Denied</CardTitle>
            <CardDescription className="text-body">Only Super Admins and Branch Managers can manage groups.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 md:space-y-6 p-3 sm:p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-heading-1 text-gray-900">Groups</h1>
            <p className="text-body text-gray-600 mt-1">Manage member groups and their portfolios</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <Button onClick={() => openDialog()} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Create Group</span>
            <span className="sm:hidden">Create</span>
          </Button>
          </div>
        </div>

        {/* Groups Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-heading-2">Groups ({groups.length})</CardTitle>
            <CardDescription className="text-body text-muted-foreground">
              All member groups in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                {
                  header: 'Group',
                  cell: (row) => (
                    <div>
                      <div className="text-body font-medium">{row.name}</div>
                      <div className="text-caption text-muted-foreground">{row.description}</div>
                    </div>
                  )
                },
                {
                  header: 'Branch',
                  cell: (row) => (
                    <div className="text-body">{row.branch_name}</div>
                  )
                },
                {
                  header: 'Members',
                  cell: (row) => (
                    <div className="text-center">
                      <div className="text-body font-medium">{row.member_count}</div>
                      <div className="text-caption text-muted-foreground">Active: {row.active_members}</div>
                    </div>
                  )
                },
                {
                  header: 'Loans',
                  cell: (row) => (
                    <div className="text-center">
                      <div className="text-body font-medium">{row.loan_count}</div>
                      <div className="text-caption text-muted-foreground">Active: {row.active_loans}</div>
                    </div>
                  )
                },
                {
                  header: 'Portfolio',
                  cell: (row) => (
                    <div className="text-right">
                      <div className="text-body font-medium">{formatCurrency(row.total_portfolio)}</div>
                      <div className="text-caption text-muted-foreground">Outstanding: {formatCurrency(row.total_outstanding)}</div>
                    </div>
                  )
                },
                {
                  header: 'Health Score',
                  cell: (row) => (
                    <div className="text-center">
                      {getHealthScoreBadge(row.group_health_score || 0)}
                    </div>
                  )
                },
                {
                  header: 'Actions',
                  cell: (row) => (
                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/groups/${row.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteGroup(row.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                }
              ]}
              data={groups}
              emptyStateMessage="No groups found."
            />
          </CardContent>
        </Card>

        {/* Create/Edit Group Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md mx-4">
            <DialogHeader>
              <DialogTitle className="text-heading-3">
                {editingGroup ? 'Edit Group' : 'Create New Group'}
              </DialogTitle>
              <DialogDescription className="text-body">
                {editingGroup 
                  ? 'Update the details for this group.' 
                  : 'Add a new group to organize members.'
                }
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleFormSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-body font-medium">Group Name</Label>
                <Input 
                  id="name" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  placeholder="e.g., Youth Group, Women's Group" 
                  required 
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-body font-medium">Description</Label>
                <Input 
                  id="description" 
                  value={formData.description} 
                  onChange={(e) => setFormData({...formData, description: e.target.value})} 
                  placeholder="Brief description of the group" 
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch_id" className="text-body font-medium">Branch</Label>
                <Select value={formData.branch_id} onValueChange={(value) => setFormData({...formData, branch_id: value})}>
                  <SelectTrigger className="w-full">
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
              <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4">
                <Button type="button" variant="outline" onClick={closeDialog} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                  {isSubmitting ? (
                    <ButtonLoader size="sm" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  {editingGroup ? 'Update Group' : 'Create Group'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        
        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteCandidate} onOpenChange={() => setDeleteCandidate(null)}>
          <DialogContent className="max-w-md mx-4">
            <DialogHeader>
              <DialogTitle className="text-heading-3">Confirm Deletion</DialogTitle>
              <DialogDescription className="text-body">
                Are you sure you want to delete the group: <strong>{deleteCandidate?.name}</strong>? 
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4">
              <Button variant="outline" onClick={() => setDeleteCandidate(null)} disabled={isDeleting} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting} className="w-full sm:w-auto">
                {isDeleting ? (
                  <ButtonLoader size="sm" />
                ) : (
                  <X className="mr-2 h-4 w-4" />
                )}
                Delete Group
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manage Group Members Dialog */}
        <Dialog open={manageMembersDialogOpen} onOpenChange={setManageMembersDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden mx-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-heading-3">
                <UserPlus className="h-5 w-5" />
                <span className="truncate">Manage Members - {selectedGroup?.name}</span>
              </DialogTitle>
              <DialogDescription className="text-body">
                Add existing members to this group or remove current members
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 h-full">
              {/* Available Members to Add */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <h3 className="text-heading-4 font-semibold">Available Members</h3>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search members..." 
                      value={memberSearchTerm} 
                      onChange={(e) => setMemberSearchTerm(e.target.value)} 
                      className="pl-9 w-full" 
                    />
                  </div>
                </div>
                
                <div className="border rounded-lg p-3 sm:p-4 h-80 sm:h-96 overflow-y-auto">
                  {filteredAvailableMembers.length > 0 ? (
                    <div className="space-y-2">
                      {filteredAvailableMembers.map(member => (
                        <div 
                          key={member.id} 
                          className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedMembers.includes(member.id) 
                              ? 'bg-blue-50 border-blue-200' 
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => handleMemberSelection(member.id)}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={selectedMembers.includes(member.id)}
                              onChange={() => {}}
                              className="rounded flex-shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-medium truncate text-body">{member.full_name}</div>
                              <div className="text-caption text-muted-foreground truncate">
                                {member.id_number} • {member.phone_number}
                              </div>
                              <div className="text-caption text-muted-foreground truncate">
                                {member.branch_name}
                                {member.current_group_name && ` • Current: ${member.current_group_name}`}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="mx-auto h-12 w-12 mb-4" />
                      <p className="text-body">No available members to add</p>
                      <p className="text-caption">All members are already assigned to groups</p>
                    </div>
                  )}
                </div>
                
                <Button 
                  onClick={handleAddMembersToGroup}
                  disabled={selectedMembers.length === 0 || isManagingMembers}
                  className="w-full"
                >
                  {isManagingMembers ? (
                    <ButtonLoader size="sm" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Add {selectedMembers.length} Member(s) to Group</span>
                  <span className="sm:hidden">Add {selectedMembers.length} Member(s)</span>
                </Button>
              </div>

              {/* Current Group Members */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <h3 className="text-heading-4 font-semibold">Current Group Members</h3>
                  <Badge variant="secondary" className="text-caption">{groupMembers.length} members</Badge>
                </div>
                
                <div className="border rounded-lg p-3 sm:p-4 h-80 sm:h-96 overflow-y-auto">
                  {groupMembers.length > 0 ? (
                    <div className="space-y-2">
                      {groupMembers.map(member => (
                        <div 
                          key={member.id} 
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <Users className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium truncate text-body">{member.full_name}</div>
                              <div className="text-caption text-muted-foreground truncate">
                                {member.id_number} • {member.phone_number}
                              </div>
                              <div className="text-caption text-muted-foreground truncate">
                                {member.profession} • {formatCurrency(member.monthly_income || 0)}/month
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveMemberFromGroup(member.id)}
                            disabled={isManagingMembers}
                            className="flex-shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="mx-auto h-12 w-12 mb-4" />
                      <p className="text-body">No members in this group</p>
                      <p className="text-caption">Use the left panel to add members</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <DialogFooter className="pt-4 flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={closeManageMembersDialog} className="w-full sm:w-auto">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default Groups;