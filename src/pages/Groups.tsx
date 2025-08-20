import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Trash2, UsersRound, MapPin } from 'lucide-react';
import { Loader } from '@/components/ui/loader';

interface Group {
  id: string;
  group_code: string;
  name: string;
  location: string;
  branch: string;
  formation_date: string;
  total_members: number;
  active_members: number;
  total_loans: number;
  outstanding_balance: number;
  chairman: string;
  secretary: string;
  treasurer: string;
  status: 'active' | 'inactive' | 'suspended';
  meeting_day: string;
}

const Groups = () => {
  const { userRole, isSuperAdmin } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');

  useEffect(() => {
    // Simulate data fetch
    setTimeout(() => {
      setGroups([
        {
          id: '1',
          group_code: 'GRP001',
          name: 'Upendo Self Help Group',
          location: 'Kawangware',
          branch: 'Nairobi Central',
          formation_date: '2023-01-15',
          total_members: 25,
          active_members: 23,
          total_loans: 18,
          outstanding_balance: 875000,
          chairman: 'Alice Wanjiku',
          secretary: 'Mary Njeri',
          treasurer: 'Jane Muthoni',
          status: 'active',
          meeting_day: 'Tuesday'
        },
        {
          id: '2',
          group_code: 'GRP002',
          name: 'Tumaini Women Group',
          location: 'Likoni',
          branch: 'Mombasa',
          formation_date: '2023-03-20',
          total_members: 30,
          active_members: 28,
          total_loans: 22,
          outstanding_balance: 1250000,
          chairman: 'Fatuma Hassan',
          secretary: 'Amina Said',
          treasurer: 'Zainab Ali',
          status: 'active',
          meeting_day: 'Friday'
        },
        {
          id: '3',
          group_code: 'GRP003',
          name: 'Harambee Business Group',
          location: 'Kondele',
          branch: 'Kisumu',
          formation_date: '2022-11-10',
          total_members: 20,
          active_members: 15,
          total_loans: 8,
          outstanding_balance: 320000,
          chairman: 'Peter Ochieng',
          secretary: 'Grace Atieno',
          treasurer: 'James Owino',
          status: 'suspended',
          meeting_day: 'Thursday'
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const branches = [...new Set(groups.map(g => g.branch))];

  const filteredGroups = groups.filter(group => {
    const matchesSearch = group.group_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         group.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         group.chairman.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || group.status === statusFilter;
    const matchesBranch = branchFilter === 'all' || group.branch === branchFilter;
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
          <h1 className="text-3xl font-bold text-foreground">Groups Management</h1>
          <p className="text-muted-foreground">Manage self-help groups and their activities</p>
        </div>
        {isSuperAdmin && (
          <Button className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Add Group
          </Button>
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
            <CardTitle className="text-lg">Active Groups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">{groups.filter(g => g.status === 'active').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Total Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{groups.reduce((sum, g) => sum + g.total_members, 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">
              {formatCurrency(groups.reduce((sum, g) => sum + g.outstanding_balance, 0))}
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
                  placeholder="Search by code, name, location, or chairman..."
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

          {/* Groups Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Formation Date</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Active Loans</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead>Leadership</TableHead>
                  <TableHead>Meeting Day</TableHead>
                  <TableHead>Status</TableHead>
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
                          <div className="text-sm text-muted-foreground">{group.group_code}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm">{group.location}</div>
                          <div className="text-xs text-muted-foreground">{group.branch}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(group.formation_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="text-center">
                        <div className="font-semibold">{group.active_members}/{group.total_members}</div>
                        <div className="text-xs text-muted-foreground">Active/Total</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-semibold">{group.total_loans}</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(group.outstanding_balance)}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-1">
                        <div><span className="font-medium">Chair:</span> {group.chairman}</div>
                        <div><span className="font-medium">Sec:</span> {group.secretary}</div>
                        <div><span className="font-medium">Treas:</span> {group.treasurer}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{group.meeting_day}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          group.status === 'active' ? 'default' : 
                          group.status === 'suspended' ? 'destructive' : 'secondary'
                        }
                      >
                        {group.status}
                      </Badge>
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
          </div>

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