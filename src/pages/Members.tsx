import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Trash2, Users, Eye, Phone, MapPin } from 'lucide-react';
import { Loader } from '@/components/ui/loader';

interface Member {
  id: string;
  member_code: string;
  full_name: string;
  id_number: string;
  phone: string;
  email?: string;
  gender: 'male' | 'female';
  date_of_birth: string;
  address: string;
  group_name: string;
  branch: string;
  registration_date: string;
  status: 'active' | 'inactive' | 'suspended';
  total_loans: number;
  outstanding_balance: number;
  savings_balance: number;
  last_transaction_date?: string;
  next_of_kin: string;
  next_of_kin_phone: string;
}

const Members = () => {
  const { userRole, isAdmin } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');

  useEffect(() => {
    // Simulate data fetch
    setTimeout(() => {
      setMembers([
        {
          id: '1',
          member_code: 'MEM001',
          full_name: 'Alice Wanjiku Kamau',
          id_number: '12345678',
          phone: '+254712345678',
          email: 'alice.wanjiku@gmail.com',
          gender: 'female',
          date_of_birth: '1985-03-15',
          address: 'Kawangware, Nairobi',
          group_name: 'Upendo Self Help Group',
          branch: 'Nairobi Central',
          registration_date: '2023-01-15',
          status: 'active',
          total_loans: 3,
          outstanding_balance: 125000,
          savings_balance: 45000,
          last_transaction_date: '2024-01-10',
          next_of_kin: 'John Kamau',
          next_of_kin_phone: '+254700123456'
        },
        {
          id: '2',
          member_code: 'MEM002',
          full_name: 'Peter Ochieng Otieno',
          id_number: '87654321',
          phone: '+254787654321',
          gender: 'male',
          date_of_birth: '1978-07-22',
          address: 'Kondele, Kisumu',
          group_name: 'Harambee Business Group',
          branch: 'Kisumu',
          registration_date: '2023-02-20',
          status: 'active',
          total_loans: 2,
          outstanding_balance: 75000,
          savings_balance: 32000,
          last_transaction_date: '2024-01-08',
          next_of_kin: 'Grace Atieno',
          next_of_kin_phone: '+254722987654'
        },
        {
          id: '3',
          member_code: 'MEM003',
          full_name: 'Fatuma Hassan Ali',
          id_number: '11223344',
          phone: '+254798765432',
          email: 'fatuma.hassan@yahoo.com',
          gender: 'female',
          date_of_birth: '1990-12-05',
          address: 'Likoni, Mombasa',
          group_name: 'Tumaini Women Group',
          branch: 'Mombasa',
          registration_date: '2022-11-10',
          status: 'suspended',
          total_loans: 1,
          outstanding_balance: 200000,
          savings_balance: 15000,
          next_of_kin: 'Said Hassan',
          next_of_kin_phone: '+254733456789'
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const branches = [...new Set(members.map(m => m.branch))];

  const filteredMembers = members.filter(member => {
    const matchesSearch = member.member_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.id_number.includes(searchTerm) ||
                         member.phone.includes(searchTerm) ||
                         member.group_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (member.email && member.email.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || member.status === statusFilter;
    const matchesBranch = branchFilter === 'all' || member.branch === branchFilter;
    const matchesGender = genderFilter === 'all' || member.gender === genderFilter;
    return matchesSearch && matchesStatus && matchesBranch && matchesGender;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birth = new Date(dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
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
        {isAdmin && (
          <Button className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
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
            <CardTitle className="text-lg">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">
              {formatCurrency(members.reduce((sum, m) => sum + m.outstanding_balance, 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Total Savings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {formatCurrency(members.reduce((sum, m) => sum + m.savings_balance, 0))}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <Label htmlFor="search">Search Members</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by code, name, ID, phone, email, or group..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
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
            <div>
              <Label htmlFor="gender">Gender</Label>
              <Select value={genderFilter} onValueChange={(value: any) => setGenderFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Genders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genders</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
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

          {/* Members Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Demographics</TableHead>
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
                          <div className="text-sm text-muted-foreground">{member.member_code}</div>
                          <div className="text-xs text-muted-foreground font-mono">{member.id_number}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />
                          {member.phone}
                        </div>
                        {member.email && (
                          <div className="text-xs text-muted-foreground">{member.email}</div>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {member.address}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">
                          <Badge variant="outline" className="text-xs">
                            {member.gender} • {calculateAge(member.date_of_birth)}yrs
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Reg: {new Date(member.registration_date).toLocaleDateString()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-sm">{member.group_name}</div>
                        <div className="text-xs text-muted-foreground">{member.branch}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">
                          <span className="font-medium">Loans:</span> {member.total_loans}
                        </div>
                        <div className="text-xs">
                          <span className="font-medium">Outstanding:</span> {formatCurrency(member.outstanding_balance)}
                        </div>
                        <div className="text-xs">
                          <span className="font-medium">Savings:</span> {formatCurrency(member.savings_balance)}
                        </div>
                        {member.last_transaction_date && (
                          <div className="text-xs text-muted-foreground">
                            Last: {new Date(member.last_transaction_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{member.next_of_kin}</div>
                        <div className="text-xs text-muted-foreground">{member.next_of_kin_phone}</div>
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
                        {isAdmin && (
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
          </div>

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