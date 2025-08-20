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

interface MasterRecord {
  id: string;
  member_code: string;
  full_name: string;
  id_number: string;
  phone: string;
  group_name: string;
  branch: string;
  registration_date: string;
  status: 'active' | 'inactive' | 'suspended';
  total_loans: number;
  outstanding_balance: number;
  last_payment_date?: string;
}

const MasterRoll = () => {
  const [records, setRecords] = useState<MasterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');

  useEffect(() => {
    // Simulate data fetch
    setTimeout(() => {
      setRecords([
        {
          id: '1',
          member_code: 'MEM001',
          full_name: 'Alice Wanjiku',
          id_number: '12345678',
          phone: '+254712345678',
          group_name: 'Upendo Group',
          branch: 'Nairobi Central',
          registration_date: '2023-01-15',
          status: 'active',
          total_loans: 3,
          outstanding_balance: 125000,
          last_payment_date: '2024-01-10'
        },
        {
          id: '2',
          member_code: 'MEM002',
          full_name: 'John Kamau',
          id_number: '87654321',
          phone: '+254787654321',
          group_name: 'Tumaini Group',
          branch: 'Mombasa',
          registration_date: '2023-02-20',
          status: 'active',
          total_loans: 2,
          outstanding_balance: 75000,
          last_payment_date: '2024-01-08'
        },
        {
          id: '3',
          member_code: 'MEM003',
          full_name: 'Mary Njeri',
          id_number: '11223344',
          phone: '+254798765432',
          group_name: 'Harambee Group',
          branch: 'Kisumu',
          registration_date: '2022-11-10',
          status: 'suspended',
          total_loans: 1,
          outstanding_balance: 200000
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const branches = [...new Set(records.map(r => r.branch))];

  const filteredRecords = records.filter(record => {
    const matchesSearch = record.member_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.id_number.includes(searchTerm) ||
                         record.phone.includes(searchTerm) ||
                         record.group_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    const matchesBranch = branchFilter === 'all' || record.branch === branchFilter;
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
              {formatCurrency(records.reduce((sum, r) => sum + r.outstanding_balance, 0))}
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
                  placeholder="Search by code, name, ID, phone, or group..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-full lg:w-48">
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
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
                    <SelectItem key={branch} value={branch}>{branch}</SelectItem>
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
                  <TableHead>Member Code</TableHead>
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
                    <TableCell className="font-medium">{record.member_code}</TableCell>
                    <TableCell>{record.full_name}</TableCell>
                    <TableCell className="font-mono text-sm">{record.id_number}</TableCell>
                    <TableCell className="text-sm">{record.phone}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{record.group_name}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{record.branch}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(record.registration_date).toLocaleDateString()}
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
                    <TableCell className="text-center font-semibold">{record.total_loans}</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(record.outstanding_balance)}
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