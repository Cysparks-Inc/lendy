import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Plus,
  Search,
  Calendar,
  Building2,
  Users,
  Eye,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Phone,
  Mail,
  MapPin,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { GroupStatusDialog } from '@/components/groups/GroupStatusDialog';

interface Member {
  id: string;
  full_name: string;
  phone_number: string;
  email?: string;
  address?: string;
  group_id?: string | number;
  group_name?: string;
  branch_id?: string | number;
  branch_name?: string;
  status: string;
  created_at: string;
  total_loans_disbursed?: number;
  current_loan_balance?: number;
  loan_officer_name?: string;
}

interface Group {
  id: string | number;
  name: string;
  code?: string;
  meeting_day: number;
  meeting_time?: string;
  location?: string;
  branch_id: string | number;
  branch_name?: string;
  member_count: number;
  status: string;
  created_at: string;
  loan_officer_id?: string;
  loan_officer_name?: string;
  contact_person_id?: string;
  contact_person_name?: string;
  contact_person_phone?: string;
  is_active: boolean;
  deactivated_at?: string;
  deactivated_by?: string;
}

interface Branch {
  id: string | number;
  name: string;
  location?: string;
}

interface LoanOfficer {
  id: string;
  full_name: string;
}

const Groups: React.FC = () => {
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  
  // State
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loanOfficers, setLoanOfficers] = useState<LoanOfficer[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  
  // Filters
  const [filters, setFilters] = useState({
    group: 'all',
    branch: 'all',
    loanOfficer: 'all',
    status: 'all',
    searchTerm: ''
  });

  // Active tab
  const [activeTab, setActiveTab] = useState('members');
  
  // Contact person management
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactPersonId, setContactPersonId] = useState('');
  
  // Group status management
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [groupForStatusChange, setGroupForStatusChange] = useState<Group | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterData();
  }, [members, groups, filters]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const isLoanOfficer = userRole === 'loan_officer';
      const currentOfficerId = user?.id || '';

      // Fetch groups (restrict for loan officers)
      let groupsData: any[] | null = null;
      if (isLoanOfficer) {
        const { data, error } = await supabase
          .from('groups')
          .select('*')
          .or(`loan_officer_id.eq.${currentOfficerId},assigned_officer_id.eq.${currentOfficerId}`)
          .limit(100);
        if (error) throw error;
        groupsData = data || [];
      } else {
        const { data, error } = await supabase
          .from('groups')
          .select('*')
          .limit(100);
        if (error) throw error;
        groupsData = data || [];
      }

      // Fetch members (restrict to groups for loan officers)
      let membersData: any[] | null = null;
      if (isLoanOfficer) {
        const groupIds = (groupsData || []).map(g => g.id);
        if (groupIds.length > 0) {
          const { data, error } = await supabase
            .from('members')
            .select('*')
            .in('group_id', groupIds)
            .limit(1000);
          if (error) throw error;
          membersData = data || [];
        } else {
          membersData = [];
        }
      } else {
        const { data, error } = await supabase
          .from('members')
          .select('*')
          .limit(1000);
        if (error) throw error;
        membersData = data || [];
      }

      // Fetch branches
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('*')
        .order('name');

      if (branchesError) throw branchesError;

      // Fetch loan officers (for display/filter). Loan officers can still see their own name.
      let officersData: any[] = [];
      if (isLoanOfficer) {
        const { data } = await (supabase as any)
          .from('profiles')
          .select('*')
          .eq('id', currentOfficerId)
          .limit(1);
        officersData = data || [];
      } else {
        const { data, error } = await (supabase as any)
          .from('profiles')
          .select('*')
          .eq('role', 'loan_officer');
        if (error) throw error;
        officersData = data || [];
      }

      // Fetch financial data for members
      const memberIds = membersData?.map(m => m.id) || [];
      let loansData: any[] = [];
      
      if (memberIds.length > 0) {
        const { data: customerLoans, error: customerError } = await (supabase as any)
          .from('loans')
          .select('*')
          .in('customer_id', memberIds);
        
        const { data: memberLoans, error: memberError } = await (supabase as any)
          .from('loans')
          .select('*')
          .in('member_id', memberIds);
        
        if (customerError) console.error('Error fetching customer loans:', customerError);
        if (memberError) console.error('Error fetching member loans:', memberError);
        
        loansData = [...(customerLoans || []), ...(memberLoans || [])];
      }

      // Calculate financial data for each member
      const memberFinancialData = new Map();
      loansData?.forEach(loan => {
        const memberId = loan.customer_id || (loan as any).member_id;
        if (!memberFinancialData.has(memberId)) {
          memberFinancialData.set(memberId, {
            total_loans_disbursed: 0,
            current_loan_balance: 0
          });
        }
        
        const data = memberFinancialData.get(memberId);
        data.total_loans_disbursed += loan.principal_amount || 0;
        data.current_loan_balance += loan.current_balance || 0;
      });

      // Format members data
      const formattedMembers = membersData?.map(member => {
        const group = groupsData?.find(g => g.id === member.group_id);
        const branch = branchesData?.find(b => b.id === member.branch_id);
        const officerId = (group as any)?.loan_officer_id || (group as any)?.assigned_officer_id || null;
        const officer = officersData?.find(o => o.id === officerId);
        const financialData = memberFinancialData.get(member.id) || {
          total_loans_disbursed: 0,
          current_loan_balance: 0
        };

        return {
          ...member,
          group_name: group?.name || 'No Group',
          branch_name: branch?.name || 'Unknown',
          loan_officer_name: officer?.full_name || 'Unassigned',
          total_loans_disbursed: financialData.total_loans_disbursed,
          current_loan_balance: financialData.current_loan_balance
        };
      }) || [];

      // Format groups data
      const formattedGroups: Group[] = groupsData?.map(group => {
        const branch = branchesData?.find(b => b.id === group.branch_id);
        const officerId = (group as any).loan_officer_id || (group as any).assigned_officer_id || null;
        const officer = officersData?.find(o => o.id === officerId);
        const groupMembers = membersData?.filter(m => m.group_id === group.id) || [];
        const contactPerson = membersData?.find(m => m.id === (group as any).contact_person_id);

        return {
          id: group.id.toString(),
          name: group.name,
          code: (group as any).code,
          meeting_day: (group as any).meeting_day || 1,
          meeting_time: (group as any).meeting_time,
          location: (group as any).location,
          branch_id: group.branch_id.toString(),
          branch_name: branch?.name || 'Unknown',
          member_count: groupMembers.length,
          status: (group as any).status || 'active',
          created_at: group.created_at,
          loan_officer_id: officerId || undefined,
          loan_officer_name: officer?.full_name || 'Unassigned',
          contact_person_id: (group as any).contact_person_id,
          contact_person_name: contactPerson?.full_name || 'Not Assigned',
          contact_person_phone: contactPerson?.phone_number || ''
        };
      }) || [];

      setMembers(formattedMembers);
      setGroups(formattedGroups);
      setBranches((branchesData || []).map(branch => ({
        ...branch,
        id: branch.id.toString()
      })));
      setLoanOfficers(officersData || []);

    } catch (error: any) {
      toast.error('Failed to fetch data', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const filterData = () => {
    const isLoanOfficer = userRole === 'loan_officer';
    const currentOfficerId = user?.id || '';
    let filteredMembersData = members;
    let filteredGroupsData = groups;

    // Enforce visibility restriction for loan officers
    if (isLoanOfficer) {
      filteredGroupsData = filteredGroupsData.filter(g => g.loan_officer_id === currentOfficerId);
      const allowedGroupIds = new Set(filteredGroupsData.map(g => g.id.toString()));
      filteredMembersData = filteredMembersData.filter(m => m.group_id && allowedGroupIds.has(m.group_id.toString()));
    }

    // Apply search filter
    if (filters.searchTerm) {
      filteredMembersData = filteredMembersData.filter(member =>
        member.full_name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        member.phone_number.includes(filters.searchTerm) ||
        member.email?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        member.group_name?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        member.branch_name?.toLowerCase().includes(filters.searchTerm.toLowerCase())
      );

      filteredGroupsData = filteredGroupsData.filter(group =>
        group.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        group.code?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        group.branch_name?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        group.loan_officer_name?.toLowerCase().includes(filters.searchTerm.toLowerCase())
      );
    }

    // Apply group filter
    if (filters.group !== 'all') {
      filteredMembersData = filteredMembersData.filter(member => 
        member.group_id?.toString() === filters.group
      );
      filteredGroupsData = filteredGroupsData.filter(group => 
        group.id.toString() === filters.group
      );
    }

    // Apply branch filter
    if (filters.branch !== 'all') {
      filteredMembersData = filteredMembersData.filter(member => 
        member.branch_id?.toString() === filters.branch
      );
      filteredGroupsData = filteredGroupsData.filter(group => 
        group.branch_id.toString() === filters.branch
      );
    }

    // Apply status filter
    if (filters.status !== 'all') {
      filteredMembersData = filteredMembersData.filter(member => 
        member.status === filters.status
      );
      filteredGroupsData = filteredGroupsData.filter(group => 
        group.status === filters.status
      );
    }

    // Apply loan officer filter
    if (filters.loanOfficer !== 'all') {
      const selectedOfficer = loanOfficers.find(o => o.id === filters.loanOfficer);
      if (selectedOfficer) {
        filteredMembersData = filteredMembersData.filter(member => 
          member.loan_officer_name === selectedOfficer.full_name
        );
        filteredGroupsData = filteredGroupsData.filter(group => 
          group.loan_officer_id === filters.loanOfficer
        );
      }
    }

    setFilteredMembers(filteredMembersData);
    setFilteredGroups(filteredGroupsData);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSetContactPerson = (group: Group) => {
    setSelectedGroup(group);
    setContactPersonId(group.contact_person_id || '');
    setIsContactModalOpen(true);
  };

  const handleSaveContactPerson = async () => {
    if (!selectedGroup || !contactPersonId) return;

    try {
      const { error } = await supabase
        .from('groups')
        .update({ contact_person_id: contactPersonId } as any)
        .eq('id', selectedGroup.id as any);

      if (error) throw error;

      // Update the group in state
      setGroups(prev => 
        prev.map(group => 
          group.id === selectedGroup.id 
            ? { 
                ...group, 
                contact_person_id: contactPersonId,
                contact_person_name: members.find(m => m.id === contactPersonId)?.full_name || 'Unknown',
                contact_person_phone: members.find(m => m.id === contactPersonId)?.phone_number || ''
              }
            : group
        )
      );

      toast.success('Contact person updated successfully');
      setIsContactModalOpen(false);
      setSelectedGroup(null);
      setContactPersonId('');

    } catch (error: any) {
      toast.error('Failed to update contact person', { description: error.message });
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Groups & Members</h1>
          <p className="text-muted-foreground">
            View and manage groups and members
          </p>
        </div>
        <Button onClick={() => navigate('/groups/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Create Group
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Use filters to narrow down the data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name, phone, or group..."
                  value={filters.searchTerm}
                  onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="group">Group</Label>
              <Select
                value={filters.group}
                onValueChange={(value) => handleFilterChange('group', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id.toString()}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="branch">Branch</Label>
              <Select
                value={filters.branch}
                onValueChange={(value) => handleFilterChange('branch', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id.toString()}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="loanOfficer">Loan Officer</Label>
              <Select
                value={filters.loanOfficer}
                onValueChange={(value) => handleFilterChange('loanOfficer', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Loan Officers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Loan Officers</SelectItem>
                  {loanOfficers.map((officer) => (
                    <SelectItem key={officer.id} value={officer.id}>
                      {officer.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  group: 'all',
                  branch: 'all',
                  loanOfficer: 'all',
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

      {/* Tabs for Members and Groups */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="members">Members ({filteredMembers.length})</TabsTrigger>
          <TabsTrigger value="groups">Groups ({filteredGroups.length})</TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Members Data Sheet</CardTitle>
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
                      <TableHead>Member Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Loans Disbursed</TableHead>
                      <TableHead>Current Balance</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          {member.full_name}
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
                          {member.group_name}
                        </TableCell>
                        <TableCell>
                          {member.branch_name}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(member.status)}
                        </TableCell>
                        <TableCell>
                          KES {(member.total_loans_disbursed || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          KES {(member.current_loan_balance || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => navigate(`/members/${member.id}`)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Groups Tab */}
        <TabsContent value="groups">
          <Card>
            <CardHeader>
              <CardTitle>Groups Data Sheet</CardTitle>
              <CardDescription>
                Showing {filteredGroups.length} groups
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredGroups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No groups found matching your filters
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Group Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Meeting Day</TableHead>
                      <TableHead>Meeting Time</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Loan Officer</TableHead>
                      <TableHead>Contact Person</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGroups.map((group) => (
                      <TableRow key={group.id}>
                        <TableCell className="font-medium">
                          {group.name}
                        </TableCell>
                        <TableCell>
                          {group.code || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>{getDayName(group.meeting_day)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {group.meeting_time || 'Not set'}
                        </TableCell>
                        <TableCell>
                          {group.location ? (
                            <div className="flex items-center space-x-1">
                              <MapPin className="w-3 h-3" />
                              <span>{group.location}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Not set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {group.branch_name}
                        </TableCell>
                        <TableCell>
                          {group.loan_officer_name}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{group.contact_person_name}</span>
                            {group.contact_person_phone && (
                              <span className="text-xs text-muted-foreground">{group.contact_person_phone}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Users className="w-3 h-3" />
                            <span>{group.member_count}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(group.status)}
                            <Badge variant={group.is_active ? 'default' : 'secondary'}>
                              {group.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(group.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              onClick={() => navigate(`/groups/${group.id}`)}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              View
                            </Button>
                            {(userRole === 'super_admin' || userRole === 'admin' || userRole === 'loan_officer') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSetContactPerson(group)}
                              >
                                <Users className="w-3 h-3 mr-1" />
                                Set Contact
                              </Button>
                            )}
                            {(userRole === 'super_admin' || userRole === 'branch_admin') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setGroupForStatusChange(group);
                                  setStatusDialogOpen(true);
                                }}
                                className={group.is_active ? 'text-orange-600 hover:text-orange-700' : 'text-green-600 hover:text-green-700'}
                              >
                                <Settings className="w-3 h-3 mr-1" />
                                {group.is_active ? 'Deactivate' : 'Activate'}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Contact Person Modal */}
      <Dialog open={isContactModalOpen} onOpenChange={setIsContactModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Contact Person</DialogTitle>
            <DialogDescription>
              Select a member from {selectedGroup?.name} to be the contact person for this group.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="contact-person">Contact Person</Label>
              <Select value={contactPersonId} onValueChange={setContactPersonId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  {selectedGroup && members
                    .filter(member => member.group_id?.toString() === selectedGroup.id)
                    .map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        <div className="flex flex-col">
                          <span>{member.full_name}</span>
                          <span className="text-xs text-muted-foreground">{member.phone_number}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsContactModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveContactPerson} disabled={!contactPersonId}>
              Save Contact Person
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Status Dialog */}
      {groupForStatusChange && (
        <GroupStatusDialog
          isOpen={statusDialogOpen}
          onClose={() => {
            setStatusDialogOpen(false);
            setGroupForStatusChange(null);
          }}
          group={groupForStatusChange}
          onStatusChanged={() => {
            fetchData(); // Refresh the groups list
          }}
        />
      )}
    </div>
  );
};

export default Groups;