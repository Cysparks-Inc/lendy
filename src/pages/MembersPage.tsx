import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Edit, Trash2, Users, Eye, Banknote, DollarSign, Loader2, UserCheck, RefreshCw, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table'; // We will use our new reusable component
import { ExportDropdown } from '@/components/ui/ExportDropdown';
import { DateRangeFilter, DateRange, filterDataByDateRange } from '@/components/ui/DateRangeFilter';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// --- Type Definitions ---
// This type matches the output of our secure database function
interface MemberSummary {
  member_id: string; // Changed from 'id' to 'member_id' to match RPC function
  full_name: string;
  id_number: string;
  phone_number: string;
  status: string;
  branch_name: string;
  total_loans: number;
  outstanding_balance: number;
}

const MembersPage: React.FC = () => {
  const { user, userRole } = useAuth();
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [deleteCandidate, setDeleteCandidate] = useState<MemberSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);

  // Fetch members when the component mounts or the user changes
  useEffect(() => {
    if (user) {
      fetchMembers();
    }
  }, [user]);

  const fetchMembers = async () => {
    if (!user) return;
    setLoading(true);
    try {
      console.log('Fetching members with loan data...');
      console.log('Current user role:', userRole);
      console.log('Current user ID:', user?.id);
      
      // Step 1: Fetch members based on user role
      let membersQuery = supabase.from('members').select('*');
      
      // Apply role-based filtering
      if (userRole === 'loan_officer') {
        // Loan officers can only see members assigned to them
        console.log('Filtering members for loan officer:', user?.id);
        membersQuery = membersQuery.eq('assigned_officer_id', user?.id);
      } else if (userRole === 'branch_admin') {
        // Branch admins can see members in their branch
        // TODO: Implement branch-based filtering when branch_id is available in user profile
        console.log('Branch admin - showing all members (branch filtering to be implemented)');
      } else if (userRole === 'super_admin') {
        // Super admins can see all members
        console.log('Super admin - showing all members');
      }
      
      const { data: membersData, error: membersError } = await membersQuery;
      
      if (membersError) throw membersError;
      
      console.log('Raw members data:', membersData);
      console.log('Members found:', membersData?.length || 0);
      
      if (!membersData || membersData.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }
      
      // Step 2: Fetch all loans to calculate member statistics
      const { data: loansData, error: loansError } = await supabase
        .from('loans')
        .select('member_id, customer_id, current_balance, status');

      if (loansError) {
        console.warn('Loans fetch error:', loansError);
        // Continue without loan data
      }
      
      console.log('Raw loans data for member stats:', loansData);
      
      // Step 3: Calculate loan statistics for each member
      const membersWithLoanData = membersData.map(member => {
        // Find loans for this member (try both member_id and customer_id)
        const memberLoans = (loansData || []).filter(loan => 
          loan.member_id === member.id || loan.customer_id === member.id
        );
        
        // Calculate statistics
        const totalLoans = memberLoans.length;
        const outstandingBalance = memberLoans
          .filter(loan => ['active', 'pending'].includes(loan.status))
          .reduce((sum, loan) => sum + parseFloat(loan.current_balance || 0), 0);
        
        console.log(`Member ${member.full_name}: ${totalLoans} loans, Ksh ${outstandingBalance} outstanding`);
        
        return {
          member_id: member.id,
          full_name: member.full_name || 'Unknown Member',
          id_number: member.id_number || member.id.slice(0, 8),
          phone_number: member.phone_number || 'N/A',
          status: member.status || 'active',
          branch_name: 'Nairobi', // Hardcoded for now, can be enhanced later
          total_loans: totalLoans,
          outstanding_balance: outstandingBalance
        };
      });
      
      console.log('Members with loan data calculated:', membersWithLoanData);
      setMembers(membersWithLoanData);
      
    } catch (error: any) {
      console.error('Error fetching members:', error);
      toast.error('Failed to fetch members', { description: error.message });
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!deleteCandidate) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('members').delete().eq('id', deleteCandidate.member_id);
      if (error) throw error;
      toast.success(`Member "${deleteCandidate.full_name}" deleted successfully.`);
      setDeleteCandidate(null);
      await fetchMembers(); // Refresh the list
    } catch (error: any) {
      toast.error('Failed to delete member', { description: error.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredMembers = members.filter(member =>
    member.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (member.id_number && member.id_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (member.phone_number && member.phone_number.includes(searchTerm))
  );

  // Apply date filtering to the already filtered members
  const dateFilteredMembers = filterDataByDateRange(filteredMembers, dateRange, 'created_at');

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);

  // --- DataTable Column Definitions ---
  const columns = [
    {
        header: 'Member',
        cell: (row: MemberSummary) => (
            <div>
                <div className="font-medium">{row.full_name}</div>
                <div className="text-sm text-muted-foreground">{row.branch_name}</div>
            </div>
        )
    },
    {
        header: 'Contact',
        cell: (row: MemberSummary) => (
            <div>
                <div className="font-medium">{row.phone_number}</div>
                <div className="text-sm text-muted-foreground">ID: {row.id_number}</div>
            </div>
        )
    },
    {
        header: 'Financials',
        cell: (row: MemberSummary) => (
            <div>
                <div><span className="font-semibold">Loans:</span> {row.total_loans}</div>
                <div className="text-sm text-muted-foreground">Outstanding: {formatCurrency(row.outstanding_balance)}</div>
            </div>
        )
    },
    {
        header: 'Actions',
        cell: (row: MemberSummary) => (
            <div className="flex justify-end gap-2">
                <Button asChild variant="outline" size="icon"><Link to={`/members/${row.member_id}`}><Eye className="h-4 w-4" /></Link></Button>
                <Button asChild variant="outline" size="icon"><Link to={`/members/${row.member_id}/edit`}><Edit className="h-4 w-4" /></Link></Button>
                {userRole === 'super_admin' && (
                    <Button variant="destructive" size="icon" onClick={() => setDeleteCandidate(row)}><Trash2 className="h-4 w-4" /></Button>
                )}
            </div>
        )
    }
  ];

  // Export columns configuration
  const exportColumns = [
    { header: 'Member Name', accessorKey: 'full_name' },
    { header: 'ID Number', accessorKey: 'id_number' },
    { header: 'Phone Number', accessorKey: 'phone_number' },
    { header: 'Status', accessorKey: 'status' },
    { header: 'Branch', accessorKey: 'branch_name' },
    { header: 'Total Loans', accessorKey: 'total_loans' },
    { header: 'Outstanding Balance', accessorKey: (row: MemberSummary) => formatCurrency(row.outstanding_balance) },
  ];

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
<<<<<<< HEAD
    <div className="space-y-4 md:space-y-6 p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-heading-1 text-foreground">Members</h1>
          <p className="text-body text-muted-foreground mt-1">
            Manage and view all members in your portfolio.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchMembers} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setIsAddMemberDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Member
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-heading-3">Search & Filters</CardTitle>
          <CardDescription className="text-body text-muted-foreground">
            Find specific members using search and filters
          </CardDescription>
=======
    <div className="space-y-6 p-2 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {userRole === 'loan_officer' ? 'My Assigned Members' : 'Members'}
          </h1>
          <p className="text-muted-foreground">
            {userRole === 'loan_officer' 
              ? 'View and manage members assigned to you by the super admin.'
              : 'Manage and monitor all registered members.'
            }
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <ExportDropdown 
            data={dateFilteredMembers} 
            columns={exportColumns} 
            fileName="members-report" 
            reportTitle="Members Report"
            dateRange={dateRange}
          />
          <Button asChild><Link to="/members/new"><Plus className="h-4 w-4 mr-2" />New Member</Link></Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Members" value={members.length} icon={Users} />
        <StatCard title="Active Members" value={members.filter(m => m.status === 'active').length} icon={UserCheck} />
        <StatCard title="With Loans" value={members.filter(m => m.total_loans > 0).length} icon={Banknote} />
        <StatCard title="Total Outstanding" value={formatCurrency(members.reduce((sum, m) => sum + m.outstanding_balance, 0))} icon={DollarSign} />
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle>Member Records</CardTitle>
                <CardDescription>
                  {userRole === 'loan_officer' 
                    ? `Showing ${dateFilteredMembers.length} of ${filteredMembers.length} assigned members`
                    : `Showing ${dateFilteredMembers.length} of ${filteredMembers.length} members`
                  }
                  {dateRange.from && dateRange.to && (
                    <span className="text-brand-green-600 font-medium">
                      {' '}• Filtered by date range
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
            
            {/* Filters Row - Better positioned and spaced */}
            <div className="flex flex-col lg:flex-row gap-4 w-full">
              {/* Date Filter - Takes priority */}
              <div className="flex-shrink-0">
                <DateRangeFilter
                  onDateRangeChange={setDateRange}
                  placeholder="Filter by date"
                  className="w-full lg:w-auto"
                />
              </div>
              
              {/* Search Filter */}
              <div className="flex-1 min-w-0">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by name, ID, or phone..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="pl-9 w-full" 
                  />
                </div>
              </div>
            </div>
          </div>
>>>>>>> parent of c5cf51a (design update)
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search" className="text-body font-medium">Search</Label>
              <Input
                id="search"
                placeholder="Search by name, ID, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-body"
              />
            </div>
            <div>
              <Label htmlFor="status" className="text-body font-medium">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="branch" className="text-body font-medium">Branch</Label>
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  <SelectItem value="nakuru">Nakuru</SelectItem>
                  <SelectItem value="nairobi">Nairobi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="sort" className="text-body font-medium">Sort By</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="date">Date Added</SelectItem>
                  <SelectItem value="loans">Number of Loans</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-heading-2">Members ({filteredMembers.length})</CardTitle>
          <CardDescription className="text-body text-muted-foreground">
            Showing {filteredMembers.length} of {members.length} members
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              {
                header: 'Member',
                cell: (row) => (
                  <div>
                    <Link to={`/members/${row.member_id}`} className="text-body font-medium text-primary hover:underline">
                      {row.full_name}
                    </Link>
                    <div className="text-caption text-muted-foreground">{row.id_number}</div>
                  </div>
                )
              },
              {
                header: 'Contact',
                cell: (row) => (
                  <div>
                    <div className="text-body">{row.phone_number}</div>
                    <div className="text-caption text-muted-foreground">{row.phone_number}</div>
                  </div>
                )
              },
              {
                header: 'Loans',
                cell: (row) => (
                  <div className="text-center">
                    <div className="text-body font-medium">{row.total_loans}</div>
                    <div className="text-caption text-muted-foreground">Total</div>
                  </div>
                )
              },
              {
                header: 'Outstanding',
                cell: (row) => (
                  <div className="text-right">
                    <div className="text-body font-medium">{formatCurrency(row.outstanding_balance)}</div>
                    <div className="text-caption text-muted-foreground">Balance</div>
                  </div>
                )
              },
              {
                header: 'Actions',
                cell: (row) => (
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/members/${row.member_id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteCandidate(row)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              }
            ]}
            data={filteredMembers}
            searchTerm={searchTerm}
            emptyStateMessage="No members found matching your criteria."
          />
        </CardContent>
      </Card>
      
      <Dialog open={!!deleteCandidate} onOpenChange={() => setDeleteCandidate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Confirm Deletion</DialogTitle></DialogHeader>
          <p>Are you sure you want to permanently delete "<strong>{deleteCandidate?.full_name}</strong>"? This will erase all their associated loans and payments. This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCandidate(null)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteMember} disabled={isDeleting}>{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete Member</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ElementType }> = ({ title, value, icon: Icon }) => (
  <Card className="bg-gradient-to-br from-brand-green-50 to-brand-green-100 border-brand-green-200 hover:border-brand-green-300 transition-all duration-200 hover:shadow-md">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-brand-green-800">{title}</CardTitle>
      <Icon className="h-4 w-4 text-brand-green-600" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-brand-green-700">{value}</div>
    </CardContent>
  </Card>
);

export default MembersPage;