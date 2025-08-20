import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Download, FileText, Filter } from 'lucide-react';
import { Loader } from '@/components/ui/loader';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MasterRecord {
  id: string;
  full_name: string;
  id_number: string;
  phone_number: string;
  status: string;
  created_at: string;
  group_name?: string;
  branch_name?: string;
  total_loans?: number;
  outstanding_balance?: number;
  last_payment_date?: string;
}

const MasterRoll = () => {
  const [records, setRecords] = useState<MasterRecord[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');

  const fetchRecords = async () => {
    try {
      const { data: membersData, error } = await supabase
        .from('members')
        .select(`
          *,
          groups:group_id (name),
          branches:branch_id (name)
        `);

      if (error) throw error;

      // Get loan statistics and last payment for each member
      const recordsWithStats = await Promise.all(
        (membersData || []).map(async (member) => {
          const { data: loansData } = await supabase
            .from('loans')
            .select('id, current_balance')
            .eq('customer_id', member.id);

          // Get last payment date if loans exist
          let lastPaymentDate;
          if (loansData && loansData.length > 0) {
            const { data: repaymentsData } = await supabase
              .from('repayments')
              .select('payment_date')
              .eq('loan_id', loansData[0].id)
              .order('payment_date', { ascending: false })
              .limit(1);
            
            lastPaymentDate = repaymentsData?.[0]?.payment_date;
          }

          const outstandingBalance = loansData?.reduce(
            (sum, loan) => sum + parseFloat(String(loan.current_balance || '0')), 0
          ) || 0;

          const totalLoans = loansData?.length || 0;

          return {
            id: member.id,
            full_name: member.full_name,
            id_number: member.id_number,
            phone_number: member.phone_number,
            status: member.status,
            created_at: member.created_at,
            group_name: member.groups?.name,
            branch_name: member.branches?.name,
            total_loans: totalLoans,
            outstanding_balance: outstandingBalance,
            last_payment_date: lastPaymentDate
          };
        })
      );

      setRecords(recordsWithStats);
    } catch (error) {
      console.error('Error fetching master roll:', error);
      toast.error('Failed to fetch master roll data');
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
      await Promise.all([fetchRecords(), fetchBranches()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const filteredRecords = records.filter(record => {
    const matchesSearch = record.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.id_number.includes(searchTerm) ||
                         record.phone_number.includes(searchTerm) ||
                         (record.group_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    const matchesBranch = branchFilter === 'all' || record.branch_name === branchFilter;
    return matchesSearch && matchesStatus && matchesBranch;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const handleExport = (format: 'pdf' | 'csv') => {
    // Implementation for export functionality
    toast.success(`Master roll export as ${format.toUpperCase()} initiated`);
    console.log(`Exporting master roll as ${format}`);
  };

  if (loading) {
    return <Loader size="lg" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Master Roll</h1>
          <p className="text-muted-foreground">Complete member registry and records</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport('csv')}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport('pdf')}>
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Total Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{records.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Active Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">{records.filter(r => r.status === 'active').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">
              {formatCurrency(records.reduce((sum, r) => sum + (r.outstanding_balance || 0), 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Suspended Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{records.filter(r => r.status === 'suspended').length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Master Roll Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Member Records</CardTitle>
          <CardDescription>Complete registry of all members across all branches</CardDescription>
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

          {/* Records Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member ID</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>ID Number</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Registration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total Loans</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead>Last Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium font-mono text-sm">{record.id.substring(0, 8)}</TableCell>
                    <TableCell className="font-medium">{record.full_name}</TableCell>
                    <TableCell className="font-mono text-sm">{record.id_number}</TableCell>
                    <TableCell className="text-sm">{record.phone_number}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{record.group_name || 'No Group'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{record.branch_name || 'No Branch'}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(record.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          record.status === 'active' ? 'default' : 
                          record.status === 'suspended' ? 'destructive' : 'secondary'
                        }
                      >
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-semibold">{record.total_loans || 0}</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(record.outstanding_balance || 0)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {record.last_payment_date ? new Date(record.last_payment_date).toLocaleDateString() : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredRecords.length === 0 && (
            <div className="text-center py-8">
              <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No records found matching your criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MasterRoll;