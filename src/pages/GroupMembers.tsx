import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  ArrowLeft, 
  Users,
  UserPlus,
  X,
  Loader2,
  AlertCircle,
  Search,
  Phone,
  Mail,
  MapPin,
  CheckCircle,
  XCircle,
  Eye,
  Plus
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Group {
  id: string;
  name: string;
  code?: string;
  meeting_day: number;
  meeting_time?: string;
  location?: string;
  branch_id: string;
  branch_name?: string;
  status: string;
  created_at: string;
  loan_officer_id?: string;
  loan_officer_name?: string;
}

interface GroupMember {
  id: string;
  full_name: string;
  id_number: string;
  phone_number: string;
  email?: string;
  address?: string;
  status: string;
  total_loans: number;
  active_loans: number;
  total_outstanding: number;
  last_loan_date: string;
  member_since: string;
  monthly_income?: number;
  profession?: string;
  savings_balance?: number;
  shares_balance?: number;
  current_loan_balance?: number;
  total_loans_disbursed?: number;
}

const GroupMembers: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // State
  const [group, setGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<GroupMember[]>([]);
  const [availableMembers, setAvailableMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isManagingMembers, setIsManagingMembers] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    status: 'all',
    searchTerm: ''
  });

  // Fetch group data and members
  const fetchData = async () => {
    if (!groupId) return;
    
    try {
      setLoading(true);
      
      // Fetch group details
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();
      
      if (groupError) throw groupError;

      // Fetch branch data
      const { data: branchData, error: branchError } = await supabase
        .from('branches')
        .select('*')
        .eq('id', groupData.branch_id)
        .single();

      if (branchError) throw branchError;

      // Fetch loan officer data
      let loanOfficerName = 'Unassigned';
      if (groupData.loan_officer_id) {
        const { data: officerData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', groupData.loan_officer_id)
          .single();
        
        if (officerData) {
          loanOfficerName = officerData.full_name;
        }
      }

      const groupWithData = {
        ...groupData,
        branch_name: branchData?.name || 'Unknown',
        loan_officer_name: loanOfficerName
      };

      setGroup(groupWithData);
      
      // Fetch group members
      await fetchGroupMembers(groupWithData);
      
      // Fetch available members
      await fetchAvailableMembers(groupWithData);
      
    } catch (error: any) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load group data');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupMembers = async (groupData: Group) => {
    try {
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('*')
        .eq('group_id', groupData.id);
      
      if (membersError) throw membersError;
      
      // Fetch loans for these members
      const memberIds = membersData?.map(m => m.id) || [];
      let loansData: any[] = [];
      
      if (memberIds.length > 0) {
        const { data: loans, error: loansError } = await supabase
          .from('loans')
          .select('id, customer_id, principal_amount, due_date, current_balance, status, created_at')
          .in('customer_id', memberIds);
        
        if (!loansError) {
          loansData = loans || [];
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

        const totalDisbursed = memberLoans.reduce((sum, loan) => 
          sum + parseFloat(loan.principal_amount || '0'), 0
        );
        
        const lastLoan = memberLoans.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        
        return {
          ...member,
          total_loans: memberLoans.length,
          active_loans: activeLoans.length,
          total_outstanding: totalOutstanding,
          current_loan_balance: totalOutstanding,
          total_loans_disbursed: totalDisbursed,
          last_loan_date: lastLoan?.created_at || 'Never',
          member_since: member.created_at,
          savings_balance: member.savings_balance || 0,
          shares_balance: member.shares_balance || 0
        };
      }) || [];
      
      setGroupMembers(membersWithData);
      
    } catch (error: any) {
      console.error('Failed to fetch group members:', error);
      toast.error('Failed to load group members');
    }
  };

  const fetchAvailableMembers = async (groupData: Group) => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .is('group_id', null)
        .eq('branch_id', groupData.branch_id);
      
      if (error) throw error;
      setAvailableMembers(data || []);
      
    } catch (error: any) {
      console.error('Failed to fetch available members:', error);
    }
  };

  // Filter members
  useEffect(() => {
    let filtered = groupMembers;

    // Apply search filter
    if (filters.searchTerm) {
      filtered = filtered.filter(member =>
        member.full_name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        member.id_number.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        member.phone_number.includes(filters.searchTerm) ||
        member.email?.toLowerCase().includes(filters.searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(member => member.status === filters.status);
    }

    setFilteredMembers(filtered);
  }, [groupMembers, filters]);

  // Handle adding members to group
  const handleAddMembersToGroup = async () => {
    if (selectedMembers.length === 0 || !group) return;
    
    setIsManagingMembers(true);
    try {
      const { error } = await supabase
        .from('members')
        .update({ group_id: group.id })
        .in('id', selectedMembers)
        .select();
      
      if (error) throw error;
      
      toast.success(`${selectedMembers.length} member(s) added to group`);
      setSelectedMembers([]);
      setShowAddDialog(false);
      await fetchGroupMembers(group);
      await fetchAvailableMembers(group);
    } catch (error: any) {
      console.error('Failed to add members to group:', error);
      toast.error('Failed to add members to group');
    } finally {
      setIsManagingMembers(false);
    }
  };

  // Handle removing member from group
  const handleRemoveMemberFromGroup = async (memberId: string) => {
    if (!group) return;
    
    try {
      const { error } = await supabase
        .from('members')
        .update({ group_id: null })
        .eq('id', memberId)
        .select();
      
      if (error) throw error;
      
      toast.success('Member removed from group');
      await fetchGroupMembers(group);
      await fetchAvailableMembers(group);
    } catch (error: any) {
      console.error('Failed to remove member from group:', error);
      toast.error('Failed to remove member from group');
    }
  };

  // Handle member selection
  const handleMemberSelection = (memberId: string) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedMembers.length === filteredMembers.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(filteredMembers.map(m => m.id));
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      inactive: { color: 'bg-gray-100 text-gray-800', icon: XCircle },
      suspended: { color: 'bg-red-100 text-red-800', icon: AlertCircle }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;
    const Icon = config.icon;

    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getDayName = (dayNumber: number) => {
    const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[dayNumber] || 'Unknown';
  };

  useEffect(() => {
    fetchData();
  }, [groupId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Group Not Found</h2>
          <p className="text-muted-foreground">The requested group could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={() => navigate(`/groups/${groupId}`)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Group
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{group.name} - Members</h1>
            <p className="text-muted-foreground">
              Excel-like member listing for {group.name}
            </p>
          </div>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Members
        </Button>
      </div>

      {/* Group Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Group Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Group Name</Label>
              <p className="text-lg font-semibold">{group.name}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Meeting Day</Label>
              <p className="text-lg font-semibold">{getDayName(group.meeting_day)}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Branch</Label>
              <p className="text-lg font-semibold">{group.branch_name}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Loan Officer</Label>
              <p className="text-lg font-semibold">{group.loan_officer_name}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Use filters to narrow down the member data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name, ID, or phone..."
                  value={filters.searchTerm}
                  onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => handleFilterChange('status', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => setFilters({
                  status: 'all',
                  searchTerm: ''
                })}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members Excel-like Sheet */}
      <Card>
        <CardHeader>
          <CardTitle>Group Members Data Sheet</CardTitle>
          <CardDescription>
            Showing {filteredMembers.length} members
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No members found matching your filters
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedMembers.length === filteredMembers.length && filteredMembers.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Member Name</TableHead>
                  <TableHead>ID Number</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total Loans</TableHead>
                  <TableHead>Active Loans</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead>Savings</TableHead>
                  <TableHead>Shares</TableHead>
                  <TableHead>Member Since</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedMembers.includes(member.id)}
                        onCheckedChange={() => handleMemberSelection(member.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {member.full_name}
                    </TableCell>
                    <TableCell>
                      {member.id_number}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Phone className="w-3 h-3" />
                        <span>{member.phone_number}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {member.email ? (
                        <div className="flex items-center space-x-1">
                          <Mail className="w-3 h-3" />
                          <span>{member.email}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No email</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(member.status)}
                    </TableCell>
                    <TableCell>
                      {member.total_loans}
                    </TableCell>
                    <TableCell>
                      {member.active_loans}
                    </TableCell>
                    <TableCell>
                      KES {(member.total_outstanding || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      KES {(member.savings_balance || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      KES {(member.shares_balance || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {new Date(member.member_since).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/members/${member.id}`)}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemoveMemberFromGroup(member.id)}
                        >
                          <X className="w-3 h-3 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Members Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Add Members to Group</DialogTitle>
            <DialogDescription>
              Select members to add to {group.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedMembers.length === availableMembers.length && availableMembers.length > 0}
                        onCheckedChange={() => {
                          if (selectedMembers.length === availableMembers.length) {
                            setSelectedMembers([]);
                          } else {
                            setSelectedMembers(availableMembers.map(m => m.id));
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>ID Number</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedMembers.includes(member.id)}
                          onCheckedChange={() => handleMemberSelection(member.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {member.full_name}
                      </TableCell>
                      <TableCell>
                        {member.id_number}
                      </TableCell>
                      <TableCell>
                        {member.phone_number}
                      </TableCell>
                      <TableCell>
                        {member.email || 'No email'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(member.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                setSelectedMembers([]);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddMembersToGroup}
              disabled={selectedMembers.length === 0 || isManagingMembers}
            >
              {isManagingMembers && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add {selectedMembers.length} Member(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroupMembers;