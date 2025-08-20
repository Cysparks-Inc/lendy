import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  UserPlus, 
  Search, 
  Edit, 
  UserCheck, 
  Landmark, 
  Banknote, 
  MoreHorizontal,
  Eye,
  Mail,
  Phone,
  MapPin,
  TrendingUp,
  Users,
  RefreshCw,
  Filter,
  Download,
  AlertTriangle
} from 'lucide-react';
import { Loader } from '@/components/ui/loader';
import { toast } from 'sonner';
import { ScrollableContainer } from '@/components/ui/scrollable-container';

interface LoanOfficer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  branch_id?: string;
  branch_name: string;
  active_loans: number;
  total_loans: number;
  pending_loans: number;
  completed_loans: number;
  defaulted_loans: number;
  total_disbursed: number;
  total_balance: number;
  created_at: string;
  profile_picture_url?: string;
  status: 'active' | 'inactive';
}

const LoanOfficerPage = () => {
  const [officers, setOfficers] = useState<LoanOfficer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    fetchLoanOfficers();
  }, []);

  const fetchLoanOfficers = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      // Get all profiles with loan_officer role and their branch information
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          phone_number,
          role,
          branch_id,
          created_at,
          profile_picture_url,
          branches(
            id,
            name
          )
        `)
        .eq('role', 'loan_officer');

      if (profilesError) throw profilesError;

      // Get all loan officer IDs
      const officerIds = profilesData.map(profile => profile.id);
      
      // Get loan statistics for each officer
      let loansData = [];
      if (officerIds.length > 0) {
        const { data: loans, error: loansError } = await supabase
          .from('loans')
          .select(`
            created_by,
            principal_amount,
            current_balance,
            status
          `)
          .in('created_by', officerIds);

        if (loansError) throw loansError;
        loansData = loans || [];
      }

      // Process the data to create loan officer objects
      const mappedOfficers: LoanOfficer[] = profilesData.map(profile => {
        const branch = profile.branches;
        const officerLoans = loansData.filter(loan => loan.created_by === profile.id);

        // Calculate loan statistics
        const stats = {
          total_loans: officerLoans.length,
          active_loans: officerLoans.filter(l => l.status === 'active').length,
          pending_loans: officerLoans.filter(l => l.status === 'pending').length,
          completed_loans: officerLoans.filter(l => l.status === 'completed').length,
          defaulted_loans: officerLoans.filter(l => l.status === 'defaulted').length,
          total_disbursed: officerLoans
            .filter(l => ['active', 'completed', 'defaulted'].includes(l.status))
            .reduce((sum, l) => sum + (l.principal_amount || 0), 0),
          total_balance: officerLoans
            .filter(l => l.status === 'active')
            .reduce((sum, l) => sum + (l.current_balance || 0), 0)
        };

        return {
          id: profile.id,
          name: profile.full_name || 'N/A',
          email: profile.email || 'N/A',
          phone: profile.phone_number,
          branch_id: profile.branch_id,
          branch_name: branch?.name || 'No Branch Assigned',
          created_at: profile.created_at,
          profile_picture_url: profile.profile_picture_url,
          status: stats.total_loans > 0 ? 'active' : 'inactive', // Simple logic - can be enhanced
          ...stats
        };
      });

      setOfficers(mappedOfficers);
      
      if (isRefresh) {
        toast.success('Data refreshed successfully');
      }
    } catch (error: any) {
      toast.error('Failed to fetch loan officers', { 
        description: error.message 
      });
      console.error('Error fetching loan officers:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchLoanOfficers(true);
  };

  const handleViewDetails = (officerId: string) => {
    // Navigate to officer details page
    window.location.href = `/loan-officers/${officerId}`;
  };

  const handleSendEmail = (email: string) => {
    window.location.href = `mailto:${email}`;
  };

  const handleExportData = () => {
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Branch', 'Total Loans', 'Active Loans', 'Pending Loans', 'Completed Loans', 'Defaulted Loans', 'Total Disbursed', 'Current Balance', 'Status'],
      ...filteredOfficers.map(officer => [
        officer.name,
        officer.email,
        officer.phone || '',
        officer.branch_name,
        officer.total_loans.toString(),
        officer.active_loans.toString(),
        officer.pending_loans.toString(),
        officer.completed_loans.toString(),
        officer.defaulted_loans.toString(),
        officer.total_disbursed.toString(),
        officer.total_balance.toString(),
        officer.status
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loan-officers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredOfficers = officers.filter(officer => {
    const matchesSearch = officer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         officer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         officer.branch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (officer.phone && officer.phone.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || officer.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
  
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', {
    style: 'currency', 
    currency: 'KES', 
    minimumFractionDigits: 0
  }).format(amount || 0);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Calculate summary statistics
  const totalOfficers = officers.length;
  const activeOfficers = officers.filter(o => o.status === 'active').length;
  const totalActiveLoans = officers.reduce((sum, o) => sum + o.active_loans, 0);
  const totalDisbursed = officers.reduce((sum, o) => sum + o.total_disbursed, 0);
  const totalBalance = officers.reduce((sum, o) => sum + o.total_balance, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-8 w-8" />
        <span className="ml-2 text-muted-foreground">Loading loan officers...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Loan Officers</h1>
          <p className="text-muted-foreground">
            Manage and monitor loan officer performance across all branches
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExportData}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button asChild>
            <Link to="/users">
              <UserPlus className="h-4 w-4 mr-2" />
              Manage Users
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
          title="Total Officers" 
          value={totalOfficers} 
          icon={Users}
          subtitle={`${activeOfficers} active`}
        />
        <StatCard 
          title="Active Officers" 
          value={activeOfficers} 
          icon={UserCheck}
          subtitle={`${totalOfficers > 0 ? ((activeOfficers / totalOfficers) * 100).toFixed(1) : 0}% of total`}
        />
        <StatCard 
          title="Active Loans" 
          value={totalActiveLoans} 
          icon={Banknote}
          subtitle="Currently active"
        />
        <StatCard 
          title="Total Disbursed" 
          value={formatCurrency(totalDisbursed)} 
          icon={Landmark}
          subtitle="All time"
        />
        <StatCard 
          title="Outstanding Balance" 
          value={formatCurrency(totalBalance)} 
          icon={TrendingUp}
          subtitle="Current balance"
        />
      </div>

      {/* Officers Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <CardTitle>Officer Directory</CardTitle>
              <CardDescription>
                {filteredOfficers.length} of {totalOfficers} officers
                {searchTerm && ` matching "${searchTerm}"`}
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search officers..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="pl-9 w-full sm:w-64" 
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Filter className="h-4 w-4 mr-2" />
                    {statusFilter === 'all' ? 'All Status' : statusFilter}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                    All Status
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('active')}>
                    Active Only
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('inactive')}>
                    Inactive Only
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Officer</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Loan Portfolio</TableHead>
                  <TableHead className="text-right">Performance</TableHead>
                  <TableHead className="text-right">Financial Summary</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOfficers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      {searchTerm || statusFilter !== 'all' 
                        ? 'No officers match your filters' 
                        : 'No loan officers found'
                      }
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOfficers.map(officer => (
                    <TableRow key={officer.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0 h-10 w-10">
                            {officer.profile_picture_url ? (
                              <img 
                                className="h-10 w-10 rounded-full" 
                                src={officer.profile_picture_url} 
                                alt={officer.name} 
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-sm font-medium text-primary">
                                  {officer.name.charAt(0)}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="font-medium">{officer.name}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {officer.email}
                            </div>
                            {officer.phone && (
                              <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {officer.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{officer.branch_name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Joined: {formatDate(officer.created_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={officer.status === 'active' ? 'default' : 'secondary'}>
                          {officer.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="space-y-1">
                          <div className="font-semibold text-green-600">
                            {officer.active_loans} active
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {officer.total_loans} total loans
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {officer.pending_loans} pending
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="space-y-1">
                          <div className="text-sm text-green-600">
                            {officer.completed_loans} completed
                          </div>
                          {officer.defaulted_loans > 0 && (
                            <div className="text-sm text-red-600 flex items-center justify-end gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {officer.defaulted_loans} defaulted
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Success rate: {officer.total_loans > 0 
                              ? `${((officer.completed_loans / officer.total_loans) * 100).toFixed(1)}%`
                              : 'N/A'
                            }
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="space-y-1">
                          <div className="font-mono font-semibold text-sm">
                            {formatCurrency(officer.total_disbursed)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Disbursed
                          </div>
                          <div className="font-mono text-sm text-blue-600">
                            {formatCurrency(officer.total_balance)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Outstanding
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(officer.id)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSendEmail(officer.email)}>
                              <Mail className="h-4 w-4 mr-2" />
                              Send Email
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to={`/users/${officer.id}/edit`}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Profile
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollableContainer>
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  subtitle 
}: { 
  title: string;
  value: string | number;
  icon: React.ElementType;
  subtitle?: string;
}) => (
  <Card className="hover:shadow-md transition-shadow">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
    </CardContent>
  </Card>
);

export default LoanOfficerPage;