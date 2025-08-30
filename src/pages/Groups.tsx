import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Plus, 
  Users, 
  Building2, 
  UserCheck, 
  Calendar, 
  MapPin, 
  DollarSign,
  AlertCircle,
  UserPlus,
  X,
  Search,
  Filter,
  Download,
  Eye,
  CreditCard,
  Landmark,
  Banknote,
  Loader2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// jsPDF for PDF export
declare global {
  interface Window {
    jsPDF: any;
  }
}

// Types
interface Branch {
  id: number;
  name: string;
  location: string;
}

interface Group {
  id: number;
  name: string;
  description: string;
  branch_id: number;
  branch_name: string;
  meeting_day: number;
  created_at: string;
  member_count: number;
}

interface GroupMember {
  id: string;
  full_name: string;
  id_number: string;
  phone_number: string;
  email: string;
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
  branch_id?: number;
}

interface GroupTransaction {
  id: string;
  member_name: string;
  program_name: string;
  disbursed_date: string;
  outstanding_amount: number;
  loan_collection: number;
  security_deposit: number;
  security_balance: number;
  as_on_outstanding: number;
  member_id: string;
  loan_id: string;
  status: string;
  principal_amount: number;
  interest_amount: number;
  processing_fee: number;
  total_paid: number;
  current_balance: number;
}

interface LoanOfficer {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
}

const Groups: React.FC = () => {
  // State
  const [groups, setGroups] = useState<Group[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loanOfficers, setLoanOfficers] = useState<LoanOfficer[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [availableMembers, setAvailableMembers] = useState<GroupMember[]>([]);
  const [groupTransactions, setGroupTransactions] = useState<GroupTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManagingMembers, setIsManagingMembers] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [officerFilter, setOfficerFilter] = useState('');
  const [processFilter, setProcessFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [manageMembersOpen, setManageMembersOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    branch_id: '',
    meeting_day: 1
  });

  // Auth context
  const { user, profile } = useAuth();
  const userRole = profile?.role || 'member';

  // Fetch data functions
  const fetchGroups = async () => {
    try {
      // First fetch groups
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('*')
        .order('name');
      
      if (groupsError) throw groupsError;
      
      // Then fetch branches for these groups
      const branchIds = [...new Set(groupsData?.map(g => g.branch_id).filter(Boolean))];
      let branchesMap = new Map();
      
      if (branchIds.length > 0) {
        const { data: branchesData, error: branchesError } = await supabase
          .from('branches')
          .select('id, name, location')
          .in('id', branchIds);
        
        if (!branchesError && branchesData) {
          branchesMap = new Map(branchesData.map(b => [b.id, b]));
        }
      }
      
      // Fetch member counts for each group
      const groupsWithData = groupsData?.map(group => {
        const branch = branchesMap.get(group.branch_id);
        
        return {
          ...group,
          branch_name: branch?.name || 'Unknown',
          member_count: 0 // We'll fetch this separately if needed
        };
      }) || [];
      
      setGroups(groupsWithData);
      
      // Now fetch member counts for each group
      const memberCountPromises = groupsWithData.map(async (group) => {
        try {
          const { count, error } = await supabase
            .from('members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);
          
          if (!error && count !== null) {
            return { groupId: group.id, count };
          }
          return { groupId: group.id, count: 0 };
        } catch (err) {
          console.error(`Failed to get member count for group ${group.id}:`, err);
          return { groupId: group.id, count: 0 };
        }
      });
      
      const memberCounts = await Promise.all(memberCountPromises);
      
      // Update groups with member counts
      setGroups(prevGroups => 
        prevGroups.map(group => {
          const memberCount = memberCounts.find(mc => mc.groupId === group.id);
          return {
            ...group,
            member_count: memberCount?.count || 0
          };
        })
      );
      
    } catch (error: any) {
      console.error('Failed to fetch groups:', error);
      toast.error('Failed to load groups');
    }
  };

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setBranches(data || []);
    } catch (error: any) {
      console.error('Failed to fetch branches:', error);
    }
  };

  const fetchLoanOfficers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone_number')
        .eq('role', 'loan_officer');
      
      if (error) throw error;
      setLoanOfficers(data || []);
    } catch (error: any) {
      console.error('Failed to fetch loan officers:', error);
    }
  };

  const fetchGroupMembers = async (group: Group) => {
    try {
      console.log('🔍 Fetching members for group:', group.id);
      
      // First fetch members in the group
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('*')
        .eq('group_id', group.id);
      
      console.log('📊 Members data:', membersData);
      console.log('❌ Members error:', membersError);
      
      if (membersError) throw membersError;
      
      // Then fetch loans for these members
      const memberIds = membersData?.map(m => m.id) || [];
      console.log('🆔 Member IDs found:', memberIds);
      
      let loansData: any[] = [];
      
      if (memberIds.length > 0) {
        const { data: loans, error: loansError } = await supabase
          .from('loans')
          .select('id, customer_id, principal_amount, due_date, current_balance, status, loan_officer_id, created_at')
          .in('customer_id', memberIds);
        
        console.log('💰 Loans data:', loans);
        console.log('❌ Loans error:', loansError);
        
        if (loansError) {
          console.error('Loans fetch error:', loansError);
        } else {
          loansData = loans || [];
        }
      }
      
      // Fetch loan officer names
      const officerIds = [...new Set(loansData.map(loan => loan.loan_officer_id).filter(Boolean))];
      let officersMap = new Map();
      
      if (officerIds.length > 0) {
        const { data: officers, error: officersError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', officerIds);
        
        if (!officersError && officers) {
          officersMap = new Map(officers.map(o => [o.id, o.full_name]));
        }
      }
      
      const membersWithData = membersData?.map(member => {
        const memberLoans = loansData.filter(loan => loan.customer_id === member.id);
        const activeLoans = memberLoans.filter(loan => 
          loan.status === 'active' || loan.status === 'overdue'
        );
        
        const totalOutstanding = activeLoans.reduce((sum, loan) => 
          sum + parseFloat(loan.current_balance || '0'), 0
        );
        
        const lastLoan = memberLoans.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        
        return {
          ...member,
          total_loans: memberLoans.length,
          active_loans: activeLoans.length,
          total_outstanding: totalOutstanding,
          last_loan_date: lastLoan?.created_at || 'Never',
          loan_officer_name: lastLoan?.loan_officer_id ? (officersMap.get(lastLoan.loan_officer_id) || 'Unknown') : 'Unassigned',
          assigned_officer_id: lastLoan?.loan_officer_id || '',
          branch_id: member.branch_id
        };
      }) || [];
      
      console.log('✅ Final members with data:', membersWithData);
      setGroupMembers(membersWithData);
      
    } catch (error: any) {
      console.error('Failed to fetch group members:', error);
      toast.error('Failed to load group members');
    }
  };

  const fetchAvailableMembers = async (group: Group) => {
    try {
      console.log('🔍 Fetching available members for group:', group.id, 'branch:', group.branch_id);
      
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .is('group_id', null)
        .eq('branch_id', group.branch_id);
      
      console.log('📊 Available members data:', data);
      console.log('❌ Available members error:', error);
      
      if (error) throw error;
      setAvailableMembers(data || []);
      
    } catch (error: any) {
      console.error('Failed to fetch available members:', error);
    }
  };

  const fetchGroupTransactions = async (group: Group) => {
    try {
      console.log('🔍 Fetching transactions for group:', group.id);
      
      // First get all members in the group
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('id, full_name')
        .eq('group_id', group.id);
      
      if (membersError) throw membersError;
      
      if (!membersData || membersData.length === 0) {
        setGroupTransactions([]);
        return;
      }
      
      const memberIds = membersData.map(m => m.id);
      
      // Fetch loans for these members
      const { data: loansData, error: loansError } = await supabase
        .from('loans')
        .select(`
          id,
          customer_id,
          principal_amount,
          interest_disbursed,
          processing_fee,
          total_paid,
          current_balance,
          status,
          issue_date,
          loan_program,
          loan_officer_id
        `)
        .in('customer_id', memberIds);
      
      if (loansError) throw loansError;
      
      // Transform data to match GroupTransaction interface
      const transactions: GroupTransaction[] = (loansData || []).map(loan => {
        const member = membersData.find(m => m.id === loan.customer_id);
        const totalAmount = (loan.principal_amount || 0) + (loan.interest_disbursed || 0) + (loan.processing_fee || 0);
        
        return {
          id: `${loan.id}-${loan.customer_id}`,
          member_name: member?.full_name || 'Unknown Member',
          program_name: loan.loan_program || 'Small Loan',
          disbursed_date: loan.issue_date || new Date().toISOString().split('T')[0],
          outstanding_amount: totalAmount,
          loan_collection: loan.total_paid || 0,
          security_deposit: 0, // Not implemented in current schema
          security_balance: 0, // Not implemented in current schema
          as_on_outstanding: loan.current_balance || 0,
          member_id: loan.customer_id,
          loan_id: loan.id,
          status: loan.status || 'pending',
          principal_amount: loan.principal_amount || 0,
          interest_amount: loan.interest_disbursed || 0,
          processing_fee: loan.processing_fee || 0,
          total_paid: loan.total_paid || 0,
          current_balance: loan.current_balance || 0
        };
      });
      
      setGroupTransactions(transactions);
      
    } catch (error) {
      console.error('Failed to fetch group transactions:', error);
      toast.error('Failed to load group transactions');
    }
  };

  // Event handlers
  const handleGroupSelect = async (groupId: string) => {
    console.log('Group selected:', groupId);
    console.log('Available groups:', groups);
    
    const group = groups.find(g => g.id.toString() === groupId);
    console.log('Found group:', group);
    
    if (group) {
      setSelectedGroup(group);
      console.log('Fetching members for group:', group.id);
      await fetchGroupMembers(group);
      console.log('Fetching available members for group:', group.id);
      await fetchAvailableMembers(group);
      console.log('Fetching transactions for group:', group.id);
      await fetchGroupTransactions(group);
    } else {
      console.error('Group not found for ID:', groupId);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.branch_id) {
      toast.error('Branch selection is required');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const submitData = {
        name: formData.name,
        description: formData.description,
        branch_id: parseInt(formData.branch_id),
        meeting_day: formData.meeting_day
      };
      
      if (editingGroupId) {
        // Update existing group
        const { error } = await supabase
          .from('groups')
          .update({
            ...submitData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingGroupId);
        
        if (error) throw error;
        
        toast.success('Group updated successfully');
      } else {
        // Create new group
        const { error } = await supabase
          .from('groups')
          .insert([{
            ...submitData,
            created_by: user?.id
          }]);
        
        if (error) throw error;
        
        toast.success('Group created successfully');
      }
      
      setDialogOpen(false);
      setFormData({ name: '', description: '', branch_id: '', meeting_day: 1 });
      setEditingGroupId(null);
      fetchGroups();
    } catch (error: any) {
      console.error('Failed to save group:', error);
      toast.error(`Failed to ${editingGroupId ? 'update' : 'create'} group`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMembersToGroup = async () => {
    if (selectedMembers.length === 0 || !selectedGroup) return;
    
    setIsManagingMembers(true);
    try {
      const { error } = await supabase
        .from('members')
        .update({ group_id: selectedGroup.id })
        .in('id', selectedMembers);
      
      if (error) throw error;
      
      toast.success(`${selectedMembers.length} member(s) added to group`);
      setSelectedMembers([]);
      setManageMembersOpen(false);
      await fetchGroupMembers(selectedGroup);
      await fetchAvailableMembers(selectedGroup);
    } catch (error: any) {
      console.error('Failed to add members to group:', error);
      toast.error('Failed to add members to group');
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
      
      toast.success('Member removed from group');
      await fetchGroupMembers(selectedGroup);
      await fetchAvailableMembers(selectedGroup);
    } catch (error: any) {
      console.error('Failed to remove member from group:', error);
      toast.error('Failed to remove member from group');
    }
  };

  const closeManageMembersDialog = () => {
    setManageMembersOpen(false);
    setSelectedMembers([]);
  };

  // Filtered data - More robust filtering
  const filteredGroups = groups.filter(group => {
    const searchMatch = (group.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                       (group.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                       (group.branch_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const branchMatch = branchFilter === 'all' || !branchFilter || group.branch_id?.toString() === branchFilter;
    const dayMatch = dayFilter === 'all' || !dayFilter || group.meeting_day?.toString() === dayFilter;
    
    return searchMatch && branchMatch && dayMatch;
  });

  const filteredGroupMembers = groupMembers.filter(member => {
    const branchMatch = branchFilter === 'all' || !branchFilter || member.branch_id?.toString() === branchFilter;
    const officerMatch = officerFilter === 'all' || !officerFilter || member.assigned_officer_id === officerFilter;
    return branchMatch && officerMatch;
  });

  const filteredTransactions = groupTransactions.filter(transaction => {
    const searchMatch = transaction.member_name.toLowerCase().includes(searchTerm.toLowerCase());
    const processMatch = !processFilter || transaction.program_name.toLowerCase().includes(processFilter.toLowerCase());
    const dateMatch = !dateFilter || transaction.disbursed_date.includes(dateFilter);
    return searchMatch && processMatch && dateMatch;
  });

  // Calculate totals for transaction sheet
  const totalOutstanding = filteredTransactions.reduce((sum, t) => sum + t.outstanding_amount, 0);
  const totalAsOnOutstanding = filteredTransactions.reduce((sum, t) => sum + t.as_on_outstanding, 0);

  // Helper function for currency formatting
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', { 
      style: 'currency', 
      currency: 'KES' 
    }).format(amount || 0);
  };

  // Helper function to get day name from meeting day number
  const getDayName = (dayNumber: number) => {
    const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[dayNumber] || 'Unknown';
  };

  // PDF Export function
  const handleExportPDF = () => {
    if (!selectedGroup || filteredTransactions.length === 0) return;
    
    const doc = new window.jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text('Group Transaction Sheet', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Group: ${selectedGroup.name}`, 20, 35);
    doc.text(`Branch: ${selectedGroup.branch_name}`, 20, 45);
    doc.text(`Meeting Day: ${getDayName(selectedGroup.meeting_day)}`, 20, 55);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 65);
    
    // Table headers
    const headers = ['P#', 'Member Name', 'Program', 'Disbursed Date', 'Outstanding', 'Collection', 'As On Outstanding'];
    const data = filteredTransactions.map((transaction, index) => [
      index + 1,
      transaction.member_name,
      transaction.program_name,
      new Date(transaction.disbursed_date).toLocaleDateString('en-GB'),
      formatCurrency(transaction.outstanding_amount),
      transaction.loan_collection > 0 ? formatCurrency(transaction.loan_collection) : '-',
      formatCurrency(transaction.as_on_outstanding)
    ]);
    
    // Add totals row
    data.push(['', '', '', '', 'Total', '', formatCurrency(totalOutstanding)]);
    data.push(['', '', '', '', 'Total', '', formatCurrency(totalAsOnOutstanding)]);
    
    doc.autoTable({
      head: [headers],
      body: data,
      startY: 80,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] }
    });
    
    doc.save(`${selectedGroup.name}_transaction_sheet_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Edit Group function
  const handleEditGroup = (group: Group) => {
    if (!group) return;
    setFormData({
      name: group.name,
      description: group.description || '',
      branch_id: group.branch_id.toString(),
      meeting_day: group.meeting_day || 1
    });
    setEditingGroupId(group.id);
    setDialogOpen(true);
  };

  // Effects
  useEffect(() => {
    const initializeData = async () => {
      if (userRole === 'super_admin' || userRole === 'branch_manager') {
        try {
          await Promise.all([
            fetchGroups(),
            fetchBranches(),
            fetchLoanOfficers()
          ]);
        } catch (error) {
          console.error('Failed to initialize data:', error);
        }
      }
      setLoading(false);
    };

    initializeData();
  }, [userRole, profile]);

  useEffect(() => {
    if (selectedGroup) {
      fetchGroupMembers(selectedGroup);
      fetchAvailableMembers(selectedGroup);
    }
  }, [selectedGroup]);

  // Basic loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Access control
  if (userRole !== 'super_admin' && userRole !== 'branch_manager') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Group Transaction Sheet</h1>
            <p className="text-muted-foreground">View and manage groups</p>
          </div>
                        <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) {
                  setFormData({ name: '', description: '', branch_id: '', meeting_day: 1 });
                  setEditingGroupId(null);
                }
              }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Group
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingGroupId ? 'Edit Group' : 'Create New Group'}</DialogTitle>
                <DialogDescription>{editingGroupId ? 'Update the group information' : 'Add a new loan group to the system'}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Group Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Enter group name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Enter group description"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch_id">Branch *</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="meeting_day">Meeting Day</Label>
                  <Select value={formData.meeting_day.toString()} onValueChange={(value) => setFormData({...formData, meeting_day: parseInt(value)})}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Monday</SelectItem>
                      <SelectItem value="2">Tuesday</SelectItem>
                      <SelectItem value="3">Wednesday</SelectItem>
                      <SelectItem value="4">Thursday</SelectItem>
                      <SelectItem value="5">Friday</SelectItem>
                      <SelectItem value="6">Saturday</SelectItem>
                      <SelectItem value="7">Sunday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : editingGroupId ? 'Update Group' : 'Create Group'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Main Content - AMBS Style Group Transaction Sheet */}
        <div className="space-y-6">
          {/* Filter Controls - Functional and Clean */}
          <div className="bg-white border rounded-lg shadow-sm p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Branch</Label>
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger className="h-9 border-gray-300 bg-white">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {branches.map(branch => (
                      <SelectItem key={branch.id} value={branch.id.toString()}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Meeting Day</Label>
                <Select value={dayFilter} onValueChange={setDayFilter}>
                  <SelectTrigger className="h-9 border-gray-300 bg-white">
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All days</SelectItem>
                    <SelectItem value="1">Monday</SelectItem>
                    <SelectItem value="2">Tuesday</SelectItem>
                    <SelectItem value="3">Wednesday</SelectItem>
                    <SelectItem value="4">Thursday</SelectItem>
                    <SelectItem value="5">Friday</SelectItem>
                    <SelectItem value="6">Saturday</SelectItem>
                    <SelectItem value="7">Sunday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Group</Label>
                <Select value={selectedGroup?.id.toString() || ''} onValueChange={handleGroupSelect}>
                  <SelectTrigger className="h-9 border-gray-300 bg-white">
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredGroups.map(group => (
                      <SelectItem key={group.id} value={group.id.toString()}>
                        {group.name} - {group.branch_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Process</Label>
                <Select value={processFilter} onValueChange={setProcessFilter}>
                  <SelectTrigger className="h-9 border-gray-300 bg-white">
                    <SelectValue placeholder="Select process" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All processes</SelectItem>
                    <SelectItem value="small_loan">Small Loan</SelectItem>
                    <SelectItem value="big_loan">Big Loan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Loan Officer</Label>
                <Select value={officerFilter} onValueChange={setOfficerFilter}>
                  <SelectTrigger className="h-9 border-gray-300 bg-white">
                    <SelectValue placeholder="Select officer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All officers</SelectItem>
                    {loanOfficers.map(officer => (
                      <SelectItem key={officer.id} value={officer.id}>
                        {officer.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* AMBS Style Transaction Sheet */}
          {selectedGroup ? (
            <div className="space-y-6">
              {/* Group Summary Info - AMBS Style */}
              <div className="bg-white border rounded-lg shadow-sm p-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">{selectedGroup.member_count}</div>
                    <div className="text-sm text-gray-600 mt-1">Total Members</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{filteredTransactions.length}</div>
                    <div className="text-sm text-gray-600 mt-1">Active Loans</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600">{formatCurrency(totalOutstanding)}</div>
                    <div className="text-sm text-gray-600 mt-1">Total Outstanding</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-600">{formatCurrency(totalAsOnOutstanding)}</div>
                    <div className="text-sm text-gray-600 mt-1">As On Outstanding</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-indigo-600">{getDayName(selectedGroup.meeting_day)}</div>
                    <div className="text-sm text-gray-600 mt-1">Meeting Day</div>
                  </div>
                </div>
              </div>

                            {/* AMBS Style Transaction Table */}
              <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                {filteredTransactions.length > 0 ? (
                  <>
                    {/* Table Header */}
                    <div className="bg-gray-50 border-b px-6 py-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-800">Group Transaction Sheet</h3>
                                      <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setManageMembersOpen(true)}
                  disabled={availableMembers.length === 0}
                  className="h-8 px-3 text-sm"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Members
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 px-3 text-sm"
                  onClick={() => handleEditGroup(selectedGroup)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Edit Group
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 px-3 text-sm"
                  onClick={handleExportPDF}
                  disabled={filteredTransactions.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export PDF
                </Button>
              </div>
                      </div>
                    </div>
                    
                    {/* Transaction Table - Exactly like AMBS */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-100 border-b">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-r">
                              <Checkbox />
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-r">P#</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-r">Member Full Name</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-r">Program Name</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-r">Disbursed Date</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-r">Outstanding Amount</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-r">Loan Collection</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">As On Outstanding</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTransactions.map((transaction, index) => (
                            <tr key={transaction.id} className="border-b hover:bg-gray-50">
                              <td className="px-4 py-3 border-r">
                                <Checkbox />
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r">{index + 1}</td>
                              <td className="px-4 py-3 border-r">
                                <span className="font-medium text-blue-600 underline cursor-pointer hover:text-blue-800">
                                  {transaction.member_name}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700 border-r">{transaction.program_name}</td>
                              <td className="px-4 py-3 text-sm text-gray-700 border-r">
                                {new Date(transaction.disbursed_date).toLocaleDateString('en-GB')}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r">
                                {formatCurrency(transaction.outstanding_amount)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700 border-r">
                                {transaction.loan_collection > 0 ? formatCurrency(transaction.loan_collection) : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {formatCurrency(transaction.as_on_outstanding)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-100 border-t">
                          <tr className="font-medium">
                            <td className="px-4 py-3 border-r"></td>
                            <td className="px-4 py-3 border-r"></td>
                            <td className="px-4 py-3 border-r"></td>
                            <td className="px-4 py-3 border-r"></td>
                            <td className="px-4 py-3 border-r"></td>
                            <td className="px-4 py-3 text-sm border-r">Total</td>
                            <td className="px-4 py-3 text-sm border-r">-</td>
                            <td className="px-4 py-3 text-sm font-bold text-gray-900">{formatCurrency(totalOutstanding)}</td>
                          </tr>
                          <tr className="font-medium">
                            <td className="px-4 py-3 border-r"></td>
                            <td className="px-4 py-3 border-r"></td>
                            <td className="px-4 py-3 border-r"></td>
                            <td className="px-4 py-3 border-r"></td>
                            <td className="px-4 py-3 border-r"></td>
                            <td className="px-4 py-3 text-sm border-r">Total</td>
                            <td className="px-4 py-3 text-sm border-r">-</td>
                            <td className="px-4 py-3 text-sm font-bold text-gray-900">{formatCurrency(totalAsOnOutstanding)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-16 text-gray-500">
                    <CreditCard className="mx-auto h-16 w-16 mb-4 text-gray-400" />
                    <p className="text-lg font-medium text-gray-600">No transactions found</p>
                    <p className="text-sm text-gray-500">Select a group to view its transaction data</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border rounded-lg shadow-sm">
              <div className="text-center py-16 text-gray-500">
                <CreditCard className="mx-auto h-16 w-16 mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold mb-2 text-gray-600">No Group Selected</h3>
                <p className="text-sm text-gray-500">Select a group from the dropdown above to view its transaction sheet, member loans, and financial data</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Members Dialog */}
      <Dialog open={manageMembersOpen} onOpenChange={setManageMembersOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Members to {selectedGroup?.name}</DialogTitle>
            <DialogDescription>Select members to add to this group</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Available Members */}
            <div className="space-y-4 flex-1 overflow-hidden">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h3 className="text-base md:text-lg font-semibold">Available Members</h3>
                <Badge variant="secondary" className="text-xs">{availableMembers.length} available</Badge>
              </div>
              
              <div className="border rounded-lg p-3 sm:p-4 h-80 sm:h-96 overflow-y-auto flex-1">
                {availableMembers.length > 0 ? (
                  <div className="space-y-2">
                    {availableMembers.map(member => (
                      <div 
                        key={member.id} 
                        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => {
                          if (selectedMembers.includes(member.id)) {
                            setSelectedMembers(selectedMembers.filter(id => id !== member.id));
                          } else {
                            setSelectedMembers([...selectedMembers, member.id]);
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(member.id)}
                          onChange={() => {}}
                          className="flex-shrink-0"
                        />
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Users className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate text-sm md:text-base">{member.full_name}</div>
                            <div className="text-xs md:text-sm text-muted-foreground truncate">
                              {member.id_number} • {member.phone_number}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {member.profession} • {member.monthly_income ? `$${member.monthly_income.toLocaleString()}/month` : 'No income data'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="mx-auto h-12 w-12 mb-4" />
                    <p className="text-sm md:text-base">No available members to add</p>
                    <p className="text-xs md:text-sm">All members are already assigned to groups</p>
                  </div>
                )}
              </div>
              
              <Button 
                onClick={handleAddMembersToGroup}
                disabled={selectedMembers.length === 0 || isManagingMembers}
                className="w-full"
              >
                {isManagingMembers ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
                <h3 className="text-base md:text-lg font-semibold">Current Group Members</h3>
                <Badge variant="secondary" className="text-xs">{groupMembers.length} members</Badge>
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
                            <div className="font-medium truncate text-sm md:text-base">{member.full_name}</div>
                            <div className="text-xs md:text-sm text-muted-foreground truncate">
                              {member.id_number} • {member.phone_number}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {member.profession} • {member.monthly_income ? `$${member.monthly_income.toLocaleString()}/month` : 'No income data'}
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
                    <p className="text-sm md:text-base">No members in this group</p>
                    <p className="text-xs md:text-sm">Use the left panel to add members</p>
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
    </>
  );
};

export default Groups;