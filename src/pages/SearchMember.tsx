import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Users, Phone, MapPin, CreditCard, Wallet } from 'lucide-react';
import { Loader } from '@/components/ui/loader';

interface MemberSearchResult {
  id: string;
  member_code: string;
  full_name: string;
  id_number: string;
  phone: string;
  email?: string;
  address: string;
  group_name: string;
  branch: string;
  status: 'active' | 'inactive' | 'suspended';
  total_loans: number;
  outstanding_balance: number;
  savings_balance: number;
  last_transaction_date?: string;
}

const SearchMember = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<MemberSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setLoading(true);
    setHasSearched(true);
    
    // Simulate search
    setTimeout(() => {
      const mockResults: MemberSearchResult[] = [
        {
          id: '1',
          member_code: 'MEM001',
          full_name: 'Alice Wanjiku Kamau',
          id_number: '12345678',
          phone: '+254712345678',
          email: 'alice.wanjiku@gmail.com',
          address: 'Kawangware, Nairobi',
          group_name: 'Upendo Self Help Group',
          branch: 'Nairobi Central',
          status: 'active',
          total_loans: 3,
          outstanding_balance: 125000,
          savings_balance: 45000,
          last_transaction_date: '2024-01-10'
        },
        {
          id: '2',
          member_code: 'MEM025',
          full_name: 'Alice Wanjiru Njuguna',
          id_number: '98765432',
          phone: '+254722345678',
          address: 'Kasarani, Nairobi',
          group_name: 'Mwanga Women Group',
          branch: 'Nairobi Central',
          status: 'active',
          total_loans: 1,
          outstanding_balance: 50000,
          savings_balance: 25000,
          last_transaction_date: '2024-01-05'
        }
      ];

      // Filter results based on search term
      const filtered = mockResults.filter(member =>
        member.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.member_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.id_number.includes(searchTerm) ||
        member.phone.includes(searchTerm) ||
        (member.email && member.email.toLowerCase().includes(searchTerm.toLowerCase()))
      );

      setSearchResults(filtered);
      setLoading(false);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Search Member</h1>
        <p className="text-muted-foreground">Find members by name, code, ID number, phone, or email</p>
      </div>

      {/* Search Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Member Search</CardTitle>
          <CardDescription>Enter any member information to find their details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Term</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Enter name, member code, ID number, phone, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleSearch} 
                className="bg-primary hover:bg-primary/90"
                disabled={!searchTerm.trim() || loading}
              >
                {loading ? (
                  <Loader size="sm" />
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            <p>You can search by:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Full name or partial name</li>
              <li>Member code (e.g., MEM001)</li>
              <li>National ID number</li>
              <li>Phone number</li>
              <li>Email address</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              Search Results {searchResults.length > 0 && `(${searchResults.length} found)`}
            </CardTitle>
            <CardDescription>
              {searchResults.length > 0 
                ? 'Click on any member to view detailed information'
                : 'No members found matching your search criteria'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {searchResults.length === 0 && !loading ? (
              <div className="text-center py-12">
                <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No Results Found</h3>
                <p className="text-muted-foreground mb-4">
                  No members found matching "{searchTerm}". Please try:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 max-w-md mx-auto">
                  <li>Checking your spelling</li>
                  <li>Using a different search term</li>
                  <li>Searching with partial information</li>
                  <li>Using the member code if known</li>
                </ul>
              </div>
            ) : (
              <div className="space-y-4">
                {searchResults.map((member) => (
                  <Card key={member.id} className="transition-shadow hover:shadow-md cursor-pointer">
                    <CardContent className="p-6">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Basic Information */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                              <Users className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">{member.full_name}</h3>
                              <p className="text-sm text-muted-foreground">{member.member_code}</p>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium">ID:</span>
                              <span className="font-mono">{member.id_number}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span>{member.phone}</span>
                            </div>
                            {member.email && (
                              <div className="flex items-center gap-2 text-sm">
                                <span>📧</span>
                                <span>{member.email}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span>{member.address}</span>
                            </div>
                          </div>
                        </div>

                        {/* Group & Branch Information */}
                        <div className="space-y-3">
                          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                            Group & Branch
                          </h4>
                          <div className="space-y-2">
                            <div>
                              <p className="font-medium">{member.group_name}</p>
                              <p className="text-sm text-muted-foreground">{member.branch}</p>
                            </div>
                            <Badge 
                              variant={
                                member.status === 'active' ? 'default' : 
                                member.status === 'suspended' ? 'destructive' : 'secondary'
                              }
                            >
                              {member.status}
                            </Badge>
                          </div>
                        </div>

                        {/* Financial Information */}
                        <div className="space-y-3">
                          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                            Financial Summary
                          </h4>
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <CreditCard className="h-5 w-5 text-primary" />
                              <div>
                                <p className="text-sm text-muted-foreground">Total Loans</p>
                                <p className="font-semibold">{member.total_loans}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <div className="h-5 w-5 rounded bg-warning/20 flex items-center justify-center">
                                <span className="text-xs">💰</span>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Outstanding</p>
                                <p className="font-semibold text-warning">
                                  {formatCurrency(member.outstanding_balance)}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <Wallet className="h-5 w-5 text-success" />
                              <div>
                                <p className="text-sm text-muted-foreground">Savings</p>
                                <p className="font-semibold text-success">
                                  {formatCurrency(member.savings_balance)}
                                </p>
                              </div>
                            </div>
                            
                            {member.last_transaction_date && (
                              <div>
                                <p className="text-sm text-muted-foreground">Last Transaction</p>
                                <p className="text-sm">
                                  {new Date(member.last_transaction_date).toLocaleDateString()}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SearchMember;