import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';  
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollableContainer } from '@/components/ui/scrollable-container';
import { Plus, Search, Edit, Trash2, UserCheck, Mail, Phone } from 'lucide-react';
import { Loader } from '@/components/ui/loader';
import { toast } from 'sonner';

interface LoanOfficer {
  id: string;
  name: string;
  email: string;
  phone: string;
  branch: string;
  active_loans: number;
  total_disbursed: number;
  status: 'active' | 'inactive';
  hire_date: string;
}

const LoanOfficer = () => {
  const { userRole, isSuperAdmin } = useAuth();
  const [officers, setOfficers] = useState<LoanOfficer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newOfficer, setNewOfficer] = useState({
    name: '',
    email: '',
    phone: '',
    branch: '',
    hire_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchLoanOfficers();
  }, []);

  const fetchLoanOfficers = async () => {
    try {
      // Get all profiles first, then filter those with loan officer role
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')  
        .select('id, full_name, email, phone_number, created_at');

      if (profilesError) throw profilesError;

      // Get user_branch_roles for loan officers
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_branch_roles')
        .select('user_id, branch_id')
        .eq('role', 'loan_officer');

      if (rolesError) throw rolesError;

      // Get branches data
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name');

      if (branchesError) throw branchesError;

      // Get loan statistics for each officer
      const officersWithStats: LoanOfficer[] = [];
      
      for (const role of rolesData || []) {
        const profile = profilesData?.find(p => p.id === role.user_id);
        const branch = branchesData?.find(b => b.id === role.branch_id);
        
        if (!profile) continue;

        const { data: loansData } = await supabase
          .from('loans')
          .select('principal_amount, status')
          .eq('loan_officer_id', role.user_id);

        const activeLoans = loansData?.filter(loan => loan.status === 'active').length || 0;
        const totalDisbursed = loansData?.reduce((sum, loan) => sum + (loan.principal_amount || 0), 0) || 0;

        officersWithStats.push({
          id: role.user_id,
          name: profile.full_name || 'Unknown',
          email: profile.email || 'No email',
          phone: profile.phone_number || 'No phone',
          branch: branch?.name || 'No branch',
          active_loans: activeLoans,
          total_disbursed: totalDisbursed,
          status: activeLoans > 0 ? 'active' : 'inactive',
          hire_date: profile.created_at || new Date().toISOString()
        });
      }

      setOfficers(officersWithStats);
    } catch (error) {
      console.error('Error fetching loan officers:', error);
      toast.error('Failed to fetch loan officers');
    } finally {
      setLoading(false);
    }
  };

  const handleAddOfficer = async () => {
    try {
      // This would typically involve creating a new user and assigning roles
      // For now, we'll show a success message
      toast.success('Loan officer functionality requires user creation system');
      setShowAddDialog(false);
      setNewOfficer({
        name: '',
        email: '',
        phone: '',
        branch: '',
        hire_date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('Error adding loan officer:', error);
      toast.error('Failed to add loan officer');
    }
  };

  const filteredOfficers = officers.filter(officer => {
    const matchesSearch = officer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         officer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         officer.branch.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || officer.status === statusFilter;
    return matchesSearch && matchesStatus;
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
          <h1 className="text-3xl font-bold text-foreground">Loan Officers</h1>
          <p className="text-muted-foreground">Manage and monitor loan officer performance</p>
        </div>
        {isSuperAdmin && (
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Add Officer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Loan Officer</DialogTitle>
                <DialogDescription>Create a new loan officer account</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={newOfficer.name}
                    onChange={(e) => setNewOfficer(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newOfficer.email}
                    onChange={(e) => setNewOfficer(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email address"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={newOfficer.phone}
                    onChange={(e) => setNewOfficer(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <Label htmlFor="branch">Branch</Label>
                  <Input
                    id="branch"
                    value={newOfficer.branch}
                    onChange={(e) => setNewOfficer(prev => ({ ...prev, branch: e.target.value }))}
                    placeholder="Enter branch name"
                  />
                </div>
                <div>
                  <Label htmlFor="hireDate">Hire Date</Label>
                  <Input
                    id="hireDate"
                    type="date"
                    value={newOfficer.hire_date}
                    onChange={(e) => setNewOfficer(prev => ({ ...prev, hire_date: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddOfficer}>
                    Add Officer
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Total Officers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{officers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Active Officers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">{officers.filter(o => o.status === 'active').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Total Active Loans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{officers.reduce((sum, o) => sum + o.active_loans, 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Total Disbursed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {formatCurrency(officers.reduce((sum, o) => sum + o.total_disbursed, 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Officers List</CardTitle>
          <CardDescription>View and manage loan officer details and performance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Officers</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name, email, or branch..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <Label htmlFor="status">Status Filter</Label>
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Officers Table */}
          <ScrollableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Officer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Active Loans</TableHead>
                  <TableHead>Total Disbursed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hire Date</TableHead>
                  {isSuperAdmin && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOfficers.map((officer) => (
                  <TableRow key={officer.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <UserCheck className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{officer.name}</div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {officer.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3" />
                        {officer.phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{officer.branch}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold">{officer.active_loans}</span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(officer.total_disbursed)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={officer.status === 'active' ? 'default' : 'secondary'}>
                        {officer.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(officer.hire_date).toLocaleDateString()}
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

          {filteredOfficers.length === 0 && (
            <div className="text-center py-8">
              <UserCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No loan officers found matching your criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LoanOfficer;