import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Edit, Trash2, Users, Eye, Phone, MapPin } from 'lucide-react';
import { ScrollableContainer } from '@/components/ui/scrollable-container';
import { Loader } from '@/components/ui/loader';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Member {
  id: string;
  full_name: string;
  id_number: string;
  phone_number: string;
  address?: string;
  status: string;
  group_id?: number;
  branch_id?: number;
  next_of_kin_name?: string;
  next_of_kin_phone?: string;
  notes?: string;
  created_at: string;
  group_name?: string;
  branch_name?: string;
  total_loans?: number;
  outstanding_balance?: number;
}

interface NewMember {
  full_name: string;
  id_number: string;
  phone_number: string;
  address: string;
  group_id: string;
  branch_id: string;
  next_of_kin_name: string;
  next_of_kin_phone: string;
  notes: string;
}

const Members = () => {
  const { userRole, isSuperAdmin, user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [newMember, setNewMember] = useState<NewMember>({
    full_name: '',
    id_number: '',
    phone_number: '',
    address: '',
    group_id: '',
    branch_id: '',
    next_of_kin_name: '',
    next_of_kin_phone: '',
    notes: ''
  });

  const fetchMembers = async () => {
    try {
      const { data: membersData, error } = await supabase
        .from('members')
        .select(`
          *,
          groups:group_id (name),
          branches:branch_id (name)
        `);

      if (error) throw error;

      // Get loan statistics for each member
      const membersWithStats = await Promise.all(
        (membersData || []).map(async (member) => {
          const { data: loansData } = await supabase
            .from('loans')
            .select('current_balance')
            .eq('customer_id', member.id);

          const totalLoans = loansData?.length || 0;
          const outstandingBalance = loansData?.reduce(
            (sum, loan) => sum + parseFloat(String(loan.current_balance || '0')), 0
          ) || 0;

          return {
            ...member,
            group_name: member.groups?.name,
            branch_name: member.branches?.name,
            total_loans: totalLoans,
            outstanding_balance: outstandingBalance
          };
        })
      );

      setMembers(membersWithStats);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast.error('Failed to fetch members');
    }
  };

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*');
      
      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*');
      
      if (error) throw error;
      setBranches(data || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchMembers(), fetchGroups(), fetchBranches()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('members')
        .insert({
          full_name: newMember.full_name,
          id_number: newMember.id_number,
          phone_number: newMember.phone_number,
          address: newMember.address,
          group_id: parseInt(newMember.group_id),
          branch_id: parseInt(newMember.branch_id),
          next_of_kin_name: newMember.next_of_kin_name,
          next_of_kin_phone: newMember.next_of_kin_phone,
          notes: newMember.notes,
          created_by: user?.id,
          status: 'active'
        });

      if (error) throw error;

      toast.success('Member created successfully');
      setDialogOpen(false);
      setNewMember({
        full_name: '',
        id_number: '',
        phone_number: '',
        address: '',
        group_id: '',
        branch_id: '',
        next_of_kin_name: '',
        next_of_kin_phone: '',
        notes: ''
      });
      fetchMembers();
    } catch (error) {
      console.error('Error creating member:', error);
      toast.error('Failed to create member');
    }
  };

  const filteredMembers = members.filter(member => {
    const matchesSearch = member.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.id_number.includes(searchTerm) ||
                         member.phone_number.includes(searchTerm) ||
                         (member.group_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || member.status === statusFilter;
    const matchesBranch = branchFilter === 'all' || member.branch_name === branchFilter;
    return matchesSearch && matchesStatus && matchesBranch;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return <Loader size="lg" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Members Management</h1>
          <p className="text-muted-foreground">Manage and monitor all registered members</p>
        </div>
        {isSuperAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Member</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateMember} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      value={newMember.full_name}
                      onChange={(e) => setNewMember({ ...newMember, full_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="id_number">ID Number</Label>
                    <Input
                      id="id_number"
                      value={newMember.id_number}
                      onChange={(e) => setNewMember({ ...newMember, id_number: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone_number">Phone Number</Label>
                    <Input
                      id="phone_number"
                      value={newMember.phone_number}
                      onChange={(e) => setNewMember({ ...newMember, phone_number: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={newMember.address}
                      onChange={(e) => setNewMember({ ...newMember, address: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="group">Group</Label>
                    <Select value={newMember.group_id} onValueChange={(value) => setNewMember({ ...newMember, group_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select group" />
                      </SelectTrigger>
                      <SelectContent>
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
                    <Select value={newMember.branch_id} onValueChange={(value) => setNewMember({ ...newMember, branch_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id.toString()}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="next_of_kin_name">Next of Kin Name</Label>
                    <Input
                      id="next_of_kin_name"
                      value={newMember.next_of_kin_name}
                      onChange={(e) => setNewMember({ ...newMember, next_of_kin_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="next_of_kin_phone">Next of Kin Phone</Label>
                    <Input
                      id="next_of_kin_phone"
                      value={newMember.next_of_kin_phone}
                      onChange={(e) => setNewMember({ ...newMember, next_of_kin_phone: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    value={newMember.notes}
                    onChange={(e) => setNewMember({ ...newMember, notes: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Member</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Total Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{members.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Active Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">{members.filter(m => m.status === 'active').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Total Loans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {members.reduce((sum, m) => sum + (m.total_loans || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">
              {formatCurrency(members.reduce((sum, m) => sum + (m.outstanding_balance || 0), 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Members Directory */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Members Directory</CardTitle>
          <CardDescription>Complete registry of all members with detailed information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Members</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name, ID, phone, or group..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-full lg:w-48">
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={(value: string) => setStatusFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full lg:w-48">
              <Label htmlFor="branch">Branch</Label>
              <Select value={branchFilter} onValueChange={(value: string) => setBranchFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map(branch => (
                    <SelectItem key={branch.id} value={branch.name}>{branch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Members Table */}
          <ScrollableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Group & Branch</TableHead>
                  <TableHead>Financial Summary</TableHead>
                  <TableHead>Emergency Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{member.full_name}</div>
                          <div className="text-sm text-muted-foreground">ID: {member.id_number}</div>
                          <div className="text-xs text-muted-foreground">
                            Member since: {new Date(member.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />
                          {member.phone_number}
                        </div>
                        {member.address && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {member.address}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-sm">{member.group_name || 'No Group'}</div>
                        <div className="text-xs text-muted-foreground">{member.branch_name || 'No Branch'}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">
                          <span className="font-medium">Loans:</span> {member.total_loans || 0}
                        </div>
                        <div className="text-xs">
                          <span className="font-medium">Outstanding:</span> {formatCurrency(member.outstanding_balance || 0)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{member.next_of_kin_name || 'N/A'}</div>
                        <div className="text-xs text-muted-foreground">{member.next_of_kin_phone || 'N/A'}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          member.status === 'active' ? 'default' : 
                          member.status === 'suspended' ? 'destructive' : 'secondary'
                        }
                      >
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isSuperAdmin && (
                          <>
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableContainer>

          {filteredMembers.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No members found matching your criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Members;