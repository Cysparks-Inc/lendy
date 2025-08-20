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
import { Plus, Search, Edit, Trash2, UsersRound, MapPin } from 'lucide-react';
import { ScrollableContainer } from '@/components/ui/scrollable-container';
import { Loader } from '@/components/ui/loader';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Group {
  id: number;
  name: string;
  location?: string;
  branch_id: number;
  branch_name?: string;
  loan_officer_id?: string;
  member_count?: number;
  total_loans?: number;
  outstanding_balance?: number;
  created_at: string;
}

interface NewGroup {
  name: string;
  location: string;
  branch_id: string;
  loan_officer_id?: string;
}

const Groups = () => {
  const { userRole, isSuperAdmin } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loanOfficers, setLoanOfficers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [newGroup, setNewGroup] = useState<NewGroup>({
    name: '',
    location: '',
    branch_id: '',
    loan_officer_id: ''
  });

  const fetchGroups = async () => {
    try {
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select(`
          *,
          branches:branch_id (name)
        `);

      if (groupsError) throw groupsError;

      // Get member counts for each group
      const groupsWithStats = await Promise.all(
        (groupsData || []).map(async (group) => {
          const { count: memberCount } = await supabase
            .from('members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);

          const { data: loansData } = await supabase
            .from('loans')
            .select('current_balance')
            .eq('group_id', group.id);

          const outstandingBalance = loansData?.reduce(
            (sum, loan) => sum + parseFloat(String(loan.current_balance || '0')), 0
          ) || 0;

          return {
            ...group,
            branch_name: group.branches?.name,
            member_count: memberCount || 0,
            total_loans: loansData?.length || 0,
            outstanding_balance: outstandingBalance
          };
        })
      );

      setGroups(groupsWithStats);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast.error('Failed to fetch groups');
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

  const fetchLoanOfficers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_branch_roles')
        .select(`
          user_id,
          profiles:user_id (full_name, email)
        `)
        .eq('role', 'loan_officer');
      
      if (error) throw error;
      setLoanOfficers(data || []);
    } catch (error) {
      console.error('Error fetching loan officers:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchGroups(), fetchBranches(), fetchLoanOfficers()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('groups')
        .insert({
          name: newGroup.name,
          location: newGroup.location,
          branch_id: parseInt(newGroup.branch_id),
          loan_officer_id: newGroup.loan_officer_id || null
        });

      if (error) throw error;

      toast.success('Group created successfully');
      setDialogOpen(false);
      setNewGroup({ name: '', location: '', branch_id: '', loan_officer_id: '' });
      fetchGroups();
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Failed to create group');
    }
  };

  const filteredGroups = groups.filter(group => {
    const matchesSearch = group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (group.location || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBranch = branchFilter === 'all' || group.branch_name === branchFilter;
    return matchesSearch && matchesBranch;
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
          <h1 className="text-3xl font-bold text-foreground">Groups Management</h1>
          <p className="text-muted-foreground">Manage self-help groups and their activities</p>
        </div>
        {isSuperAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Add Group
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Group</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div>
                  <Label htmlFor="group_name">Group Name</Label>
                  <Input
                    id="group_name"
                    value={newGroup.name}
                    onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={newGroup.location}
                    onChange={(e) => setNewGroup({ ...newGroup, location: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="branch">Branch</Label>
                  <Select value={newGroup.branch_id} onValueChange={(value) => setNewGroup({ ...newGroup, branch_id: value })}>
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
                  <Label htmlFor="loan_officer">Loan Officer (Optional)</Label>
                  <Select value={newGroup.loan_officer_id} onValueChange={(value) => setNewGroup({ ...newGroup, loan_officer_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select loan officer" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanOfficers.map((officer) => (
                        <SelectItem key={officer.user_id} value={officer.user_id}>
                          {officer.profiles?.full_name} ({officer.profiles?.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Group</Button>
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
            <CardTitle className="text-lg">Total Groups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{groups.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Total Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {groups.reduce((sum, g) => sum + (g.member_count || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Active Loans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">
              {groups.reduce((sum, g) => sum + (g.total_loans || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">
              {formatCurrency(groups.reduce((sum, g) => sum + (g.outstanding_balance || 0), 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Groups Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Groups Directory</CardTitle>
          <CardDescription>View and manage all self-help groups across branches</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Groups</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name or location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
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

          {/* Groups Table */}
          <ScrollableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Active Loans</TableHead>
                  <TableHead>Outstanding Balance</TableHead>
                  <TableHead>Created Date</TableHead>
                  {isSuperAdmin && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGroups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <UsersRound className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{group.name}</div>
                          <div className="text-sm text-muted-foreground">ID: {group.id}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{group.location || 'N/A'}</span>
                      </div>
                    </TableCell>
                    <TableCell>{group.branch_name || 'N/A'}</TableCell>
                    <TableCell>
                      <div className="text-center">
                        <div className="font-semibold">{group.member_count}</div>
                        <div className="text-xs text-muted-foreground">Members</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-semibold">{group.total_loans}</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(group.outstanding_balance || 0)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(group.created_at).toLocaleDateString()}
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableContainer>

          {filteredGroups.length === 0 && (
            <div className="text-center py-8">
              <UsersRound className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No groups found matching your criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Groups;