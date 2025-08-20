import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Download, FileText, TrendingUp, DollarSign, Target } from 'lucide-react';
import { Loader } from '@/components/ui/loader';

interface RealizableItem {
  id: string;
  asset_type: 'collateral' | 'recoverable_loan' | 'liquid_asset' | 'investment';
  description: string;
  member_name?: string;
  loan_number?: string;
  original_value: number;
  current_market_value: number;
  realizable_value: number;
  realization_period: number; // days
  risk_factor: number; // percentage
  location: string;
  branch: string;
  last_valuation_date: string;
  status: 'available' | 'in_process' | 'realized' | 'disputed';
  recovery_likelihood: 'high' | 'medium' | 'low';
  notes?: string;
}

const RealizableReport = () => {
  const [realizableItems, setRealizableItems] = useState<RealizableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [assetTypeFilter, setAssetTypeFilter] = useState<'all' | 'collateral' | 'recoverable_loan' | 'liquid_asset' | 'investment'>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'in_process' | 'realized' | 'disputed'>('all');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    // Simulate data fetch
    setTimeout(() => {
      setRealizableItems([
        {
          id: '1',
          asset_type: 'collateral',
          description: 'Motor Vehicle - Toyota Hilux 2018',
          member_name: 'Peter Ochieng Otieno',
          loan_number: 'LN002-2024',
          original_value: 1500000,
          current_market_value: 1200000,
          realizable_value: 960000,
          realization_period: 30,
          risk_factor: 20,
          location: 'Kisumu',
          branch: 'Kisumu',
          last_valuation_date: '2024-01-15',
          status: 'available',
          recovery_likelihood: 'high',
          notes: 'Vehicle in good condition, easy to sell'
        },
        {
          id: '2',
          asset_type: 'collateral',
          description: 'Land Title - 2 Acres Agricultural Land',
          member_name: 'Grace Atieno Owuor',
          loan_number: 'LN005-2023',
          original_value: 800000,
          current_market_value: 950000,
          realizable_value: 760000,
          realization_period: 90,
          risk_factor: 20,
          location: 'Siaya County',
          branch: 'Nairobi Central',
          last_valuation_date: '2023-12-10',
          status: 'available',
          recovery_likelihood: 'medium',
          notes: 'Agricultural land, market dependent on season'
        },
        {
          id: '3',
          asset_type: 'recoverable_loan',
          description: 'Outstanding loan balance',
          member_name: 'Samuel Kipchoge Ruto',
          loan_number: 'LN008-2023',
          original_value: 150000,
          current_market_value: 125000,
          realizable_value: 75000,
          realization_period: 180,
          risk_factor: 40,
          location: 'Eldoret',
          branch: 'Eldoret',
          last_valuation_date: '2024-01-01',
          status: 'in_process',
          recovery_likelihood: 'low',
          notes: 'Member defaulted, recovery through legal process'
        },
        {
          id: '4',
          asset_type: 'liquid_asset',
          description: 'Fixed Deposit Certificate',
          original_value: 500000,
          current_market_value: 520000,
          realizable_value: 520000,
          realization_period: 7,
          risk_factor: 0,
          location: 'Equity Bank',
          branch: 'Mombasa',
          last_valuation_date: '2024-01-20',
          status: 'available',
          recovery_likelihood: 'high',
          notes: 'Matured fixed deposit, immediately realizable'
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const branches = [...new Set(realizableItems.map(item => item.branch))];

  const filteredItems = realizableItems.filter(item => {
    const matchesSearch = item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.member_name && item.member_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (item.loan_number && item.loan_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         item.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAssetType = assetTypeFilter === 'all' || item.asset_type === assetTypeFilter;
    const matchesBranch = branchFilter === 'all' || item.branch === branchFilter;
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesAssetType && matchesBranch && matchesStatus;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'available': return 'default';
      case 'in_process': return 'secondary';
      case 'realized': return 'secondary';
      case 'disputed': return 'destructive';
      default: return 'secondary';
    }
  };

  const getLikelihoodBadgeVariant = (likelihood: string) => {
    switch (likelihood) {
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'destructive';
      default: return 'secondary';
    }
  };

  const handleExport = (format: 'pdf' | 'csv') => {
    console.log(`Exporting realizable assets report as ${format} for ${reportDate}`);
  };

  const totalRealizableValue = filteredItems.reduce((sum, item) => sum + item.realizable_value, 0);
  const totalMarketValue = filteredItems.reduce((sum, item) => sum + item.current_market_value, 0);

  if (loading) {
    return <Loader size="lg" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Realizable Assets Report</h1>
          <p className="text-muted-foreground">Track and evaluate recoverable assets and their realizable values</p>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Report Date</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="w-full"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Total Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{filteredItems.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Market Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {formatCurrency(totalMarketValue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Realizable Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">
              {formatCurrency(totalRealizableValue)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Asset Type Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Asset Type Distribution</CardTitle>
          <CardDescription>Breakdown of realizable assets by type and recovery likelihood</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {['collateral', 'recoverable_loan', 'liquid_asset', 'investment'].map(type => {
              const typeItems = filteredItems.filter(item => item.asset_type === type);
              const typeValue = typeItems.reduce((sum, item) => sum + item.realizable_value, 0);
              
              return (
                <div key={type} className="text-center p-4 border rounded-lg">
                  <div className="capitalize font-medium mb-2">{type.replace('_', ' ')}</div>
                  <div className="text-2xl font-bold text-primary">{typeItems.length}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatCurrency(typeValue)}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Realizable Assets Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Asset Details</CardTitle>
          <CardDescription>Comprehensive list of all realizable assets with valuation details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">Search Assets</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by description, member, or location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="assetType">Asset Type</Label>
              <Select value={assetTypeFilter} onValueChange={(value: any) => setAssetTypeFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="collateral">Collateral</SelectItem>
                  <SelectItem value="recoverable_loan">Recoverable Loan</SelectItem>
                  <SelectItem value="liquid_asset">Liquid Asset</SelectItem>
                  <SelectItem value="investment">Investment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="in_process">In Process</SelectItem>
                  <SelectItem value="realized">Realized</SelectItem>
                  <SelectItem value="disputed">Disputed</SelectItem>
                </SelectContent>
              </Select>
            </div>
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

          {/* Assets Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Details</TableHead>
                  <TableHead>Associated Loan</TableHead>
                  <TableHead>Valuation</TableHead>
                  <TableHead>Realization Timeline</TableHead>
                  <TableHead>Recovery Assessment</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          {item.asset_type === 'collateral' && <Target className="h-5 w-5 text-primary" />}
                          {item.asset_type === 'recoverable_loan' && <TrendingUp className="h-5 w-5 text-primary" />}
                          {item.asset_type === 'liquid_asset' && <DollarSign className="h-5 w-5 text-primary" />}
                          {item.asset_type === 'investment' && <FileText className="h-5 w-5 text-primary" />}
                        </div>
                        <div>
                          <div className="font-medium">{item.description}</div>
                          <Badge variant="outline" className="text-xs capitalize mt-1">
                            {item.asset_type.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.member_name ? (
                        <div className="space-y-1">
                          <div className="font-medium text-sm">{item.member_name}</div>
                          <div className="text-xs text-muted-foreground">{item.loan_number}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">
                          <span className="font-medium">Original:</span> {formatCurrency(item.original_value)}
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">Market:</span> {formatCurrency(item.current_market_value)}
                        </div>
                        <div className="text-sm font-medium text-success">
                          Realizable: {formatCurrency(item.realizable_value)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Risk: {item.risk_factor}%
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{item.realization_period} days</div>
                        <div className="text-xs text-muted-foreground">
                          Last valued: {new Date(item.last_valuation_date).toLocaleDateString()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getLikelihoodBadgeVariant(item.recovery_likelihood) as any} className="capitalize">
                        {item.recovery_likelihood}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">{item.location}</div>
                        <div className="text-xs text-muted-foreground">{item.branch}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(item.status) as any} className="capitalize">
                        {item.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.notes ? (
                        <div className="text-xs text-muted-foreground max-w-xs truncate" title={item.notes}>
                          {item.notes}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No realizable assets found for the selected criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RealizableReport;