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
  X
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManagingMembers, setIsManagingMembers] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [officerFilter, setOfficerFilter] = useState('');
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [manageMembersOpen, setManageMembersOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  
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
      
      const { error } = await supabase
        .from('groups')
        .insert([submitData]);
      
      if (error) throw error;
      
      toast.success('Group created successfully');
      setDialogOpen(false);
      setFormData({ name: '', description: '', branch_id: '', meeting_day: 1 });
      fetchGroups();
    } catch (error: any) {
      console.error('Failed to create group:', error);
      toast.error('Failed to create group');
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

  // Filtered data
  const filteredGroups = groups.filter(group =>
    (group.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (group.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (group.branch_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredGroupMembers = groupMembers.filter(member => {
    const branchMatch = branchFilter === 'all' || !branchFilter || member.branch_id?.toString() === branchFilter;
    const officerMatch = officerFilter === 'all' || !officerFilter || member.assigned_officer_id === officerFilter;
    return branchMatch && officerMatch;
  });

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
            <h1 className="text-2xl font-bold tracking-tight">Groups Management</h1>
            <p className="text-muted-foreground">Manage loan groups and their members</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Group
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Group</DialogTitle>
                <DialogDescription>Add a new loan group to the system</DialogDescription>
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
                    ) : 'Create Group'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Group Selection and Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Group Selection & Filters
              </CardTitle>
              <CardDescription>Select a group and apply filters to view detailed information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Group Selection */}
              <div className="space-y-2">
                <Label>Select Group</Label>
                <Select value={selectedGroup?.id.toString() || ''} onValueChange={handleGroupSelect}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a group to view details..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredGroups.map(group => (
                      <SelectItem key={group.id} value={group.id.toString()}>
                        {group.name} - {group.branch_name} ({group.member_count} members)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filters */}
              {selectedGroup && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Filter by Branch</Label>
                    <Select value={branchFilter} onValueChange={setBranchFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All branches" />
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
                    <Label>Filter by Loan Officer</Label>
                    <Select value={officerFilter} onValueChange={setOfficerFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All officers" />
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
              )}
            </CardContent>
          </Card>

          {/* Group Details and Members */}
          {selectedGroup ? (
            <div className="space-y-6">
              {/* Group Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {selectedGroup.name}
                  </CardTitle>
                  <CardDescription>Group details and statistics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{selectedGroup.member_count}</div>
                      <div className="text-sm text-muted-foreground">Total Members</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{filteredGroupMembers.length}</div>
                      <div className="text-sm text-muted-foreground">Filtered Members</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">{selectedGroup.branch_name}</div>
                      <div className="text-sm text-muted-foreground">Branch</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][selectedGroup.meeting_day]}
                      </div>
                      <div className="text-sm text-muted-foreground">Meeting Day</div>
                    </div>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{selectedGroup.description || 'No description'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Created: {new Date(selectedGroup.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Members Management */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <UserCheck className="h-5 w-5" />
                        Group Members ({filteredGroupMembers.length})
                      </CardTitle>
                      <CardDescription>Manage group membership and view member details</CardDescription>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => setManageMembersOpen(true)}
                      disabled={availableMembers.length === 0}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Add Members
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="members" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="members">Members List</TabsTrigger>
                      <TabsTrigger value="loans">Loan Data</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="members" className="space-y-4">
                      {filteredGroupMembers.length > 0 ? (
                        <div className="space-y-3">
                          {filteredGroupMembers.map(member => (
                            <div 
                              key={member.id} 
                              className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors gap-3"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <Users className="h-5 w-5 text-blue-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-base">{member.full_name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {member.id_number} • {member.phone_number}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {member.profession} • {member.monthly_income ? `$${member.monthly_income.toLocaleString()}/month` : 'No income data'}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Member since: {new Date(member.member_since).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex flex-col items-end gap-2 text-sm">
                                <div className="text-right">
                                  <div className="font-medium">Loans: {member.total_loans}</div>
                                  <div className="text-muted-foreground">Active: {member.active_loans}</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium text-green-600">
                                    ${member.total_outstanding.toLocaleString()}
                                  </div>
                                  <div className="text-muted-foreground">Outstanding</div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRemoveMemberFromGroup(member.id)}
                                  className="flex-shrink-0"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Users className="mx-auto h-12 w-12 mb-4" />
                          <p className="text-base">No members found</p>
                          <p className="text-sm">Try adjusting your filters or add members to this group</p>
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="loans" className="space-y-4">
                      {filteredGroupMembers.length > 0 ? (
                        <div className="space-y-3">
                          {filteredGroupMembers.map(member => (
                            <div key={member.id} className="border rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium">{member.full_name}</h4>
                                <Badge variant={member.active_loans > 0 ? "default" : "secondary"}>
                                  {member.active_loans} Active Loans
                                </Badge>
                              </div>
                              
                              {member.active_loans > 0 ? (
                                <div className="space-y-2">
                                  <div className="text-sm text-muted-foreground">
                                    Total Outstanding: <span className="font-medium text-green-600">${member.total_outstanding.toLocaleString()}</span>
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    Loan Officer: <span className="font-medium">{member.loan_officer_name}</span>
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    Last Loan: <span className="font-medium">{new Date(member.last_loan_date).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">No active loans</div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <DollarSign className="mx-auto h-12 w-12 mb-4" />
                          <p className="text-base">No loan data available</p>
                          <p className="text-sm">No members found with the current filters</p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8 md:py-12 text-muted-foreground">
                <Users className="mx-auto h-12 md:h-16 w-12 md:w-16 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Group Selected</h3>
                <p className="text-sm md:text-base">Select a group from the dropdown above to view its details, members, and loan information</p>
              </CardContent>
            </Card>
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