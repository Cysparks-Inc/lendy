import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Trash2, UserCheck } from 'lucide-react';
import { Loader } from '@/components/ui/loader';

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
  const { userRole, isAdmin } = useAuth();
  const [officers, setOfficers] = useState<LoanOfficer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    // Simulate data fetch
    setTimeout(() => {
      setOfficers([
        {
          id: '1',
          name: 'John Doe',
          email: 'john.doe@napol.com',
          phone: '+254712345678',
          branch: 'Nairobi Central',
          active_loans: 45,
          total_disbursed: 2500000,
          status: 'active',
          hire_date: '2023-01-15'
        },
        {
          id: '2',
          name: 'Jane Smith',
          email: 'jane.smith@napol.com',
          phone: '+254787654321',
          branch: 'Mombasa',
          active_loans: 32,
          total_disbursed: 1800000,
          status: 'active',
          hire_date: '2023-03-20'
        },
        {
          id: '3',
          name: 'Peter Kariuki',
          email: 'peter.kariuki@napol.com',
          phone: '+254798765432',
          branch: 'Kisumu',
          active_loans: 0,
          total_disbursed: 450000,
          status: 'inactive',
          hire_date: '2022-11-10'
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

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
        {isAdmin && (
          <Button className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Add Officer
          </Button>
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
          <div className="overflow-x-auto">
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
                  {isAdmin && <TableHead>Actions</TableHead>}
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
                          <div className="text-sm text-muted-foreground">{officer.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{officer.phone}</TableCell>
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
                    {isAdmin && (
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
          </div>

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