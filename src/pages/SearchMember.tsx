import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Users, Phone, CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

// --- Type Definitions ---
interface MemberSearchResult {
  id: string;
  full_name: string;
  id_number: string;
  phone_number: string;
  branch_name: string;
  status: 'active' | 'inactive' | 'suspended';
  total_loans: number;
  outstanding_balance: number;
  profile_picture_url: string | null;
}

const SearchMemberPage: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<MemberSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchTerm.trim() || !user) return;
    
    setLoading(true);
    setHasSearched(true);
    setError(null);
    setSearchResults([]);
    
    try {
      // Search members directly from the members table without ambiguous relationships
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select(`
          id,
          first_name,
          last_name,
          id_number,
          phone_number,
          status,
          branch_id,
          group_id
        `)
        .or(`first_name.ilike.%${searchTerm.trim()}%,last_name.ilike.%${searchTerm.trim()}%,id_number.ilike.%${searchTerm.trim()}%,phone_number.ilike.%${searchTerm.trim()}%`)
        .limit(20);

      if (membersError) throw membersError;
      
      if (!membersData || membersData.length === 0) {
        setSearchResults([]);
        return;
      }

      // Fetch branch and group names separately to avoid relationship ambiguity
      const branchIds = [...new Set(membersData.map((member: any) => member.branch_id).filter(Boolean))];
      const groupIds = [...new Set(membersData.map((member: any) => member.group_id).filter(Boolean))];

      const [branchesRes, groupsRes, loansRes] = await Promise.all([
        branchIds.length > 0 ? supabase.from('branches').select('id, name').in('id', branchIds) : { data: [], error: null },
        groupIds.length > 0 ? supabase.from('groups').select('id, name').in('id', groupIds) : { data: [], error: null },
        supabase.from('loans').select('*').in('member_id', membersData.map((member: any) => member.id))
      ]);

      if (branchesRes.error) throw branchesRes.error;
      if (groupsRes.error) throw groupsRes.error;
      if (loansRes.error) throw loansRes.error;

      // Create lookup maps
      const branchesMap = new Map((branchesRes.data || []).map(b => [b.id, b.name]));
      const groupsMap = new Map((groupsRes.data || []).map(g => [g.id, g.name]));
      const loansData = loansRes.data || [];

      // Calculate loan statistics for each member
      const membersWithLoanData = membersData.map((member: any) => {
        const memberLoans = loansData?.filter((loan: any) => loan.customer_id === member.id) || [];
        
        const totalLoans = memberLoans.length;
        const outstandingBalance = memberLoans.reduce((sum: number, loan: any) => {
          const status = loan.status as string;
          if (status === 'active' || status === 'pending') {
            return sum + (loan.current_balance || 0);
          }
          return sum;
        }, 0);

        const fullName = member.first_name && member.last_name 
          ? `${member.first_name} ${member.last_name}`.trim()
          : member.first_name || member.last_name || 'Unknown Member';
        
        return {
          id: member.id,
          full_name: fullName,
          id_number: member.id_number || member.id.slice(0, 8),
          phone_number: member.phone_number || 'N/A',
          branch_name: branchesMap.get(member.branch_id) || 'Nairobi',
          status: member.status || 'active',
          total_loans: totalLoans,
          outstanding_balance: outstandingBalance,
          profile_picture_url: null
        };
      });
      
      setSearchResults(membersWithLoanData);

    } catch (error: any) {
      setError(error.message);
      toast.error("Search Failed", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { handleSearch(); } };
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);

  return (
    <div className="space-y-6 p-2 sm:p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Search Member</h1>
        <p className="text-muted-foreground">Securely find members by name, ID number, or phone number.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Member Search</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Term</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="search" placeholder="Enter name, ID, or phone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyPress={handleKeyPress} className="pl-9" />
              </div>
            </div>
            <div className="flex items-end">
              <Button onClick={handleSearch} disabled={!searchTerm.trim() || loading} className="w-full sm:w-auto">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
            <CardDescription>
              {loading ? "Searching..." : `Found ${searchResults.length} member(s) matching your criteria.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : error ? (
              <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-10">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No Members Found</h3>
                <p className="text-muted-foreground">Your search for "{searchTerm}" did not return any results within your access level.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {searchResults.map((member) => (
                  // --- THE CRITICAL FIX: The entire card is now a clickable Link ---
                  <Link to={`/members/${member.id}`} key={member.id} className="block group">
                    <Card className="transition-all group-hover:shadow-md group-hover:border-brand-blue-300 bg-gradient-to-br from-brand-blue-50 to-brand-blue-100 border-brand-blue-200 hover:border-brand-blue-300">
                      <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                        <div className="flex items-center gap-4 col-span-1">
                          <div className="h-12 w-12 rounded-full bg-secondary flex-shrink-0 flex items-center justify-center border">
                            {member.profile_picture_url ? (<img src={member.profile_picture_url} alt={member.full_name} className="h-full w-full object-cover rounded-full" />) : (<Users className="h-6 w-6 text-muted-foreground" />)}
                          </div>
                          <div>
                            <h3 className="font-semibold group-hover:text-primary">{member.full_name}</h3>
                            <p className="text-sm text-muted-foreground">{member.branch_name}</p>
                          </div>
                        </div>
                        <div className="col-span-1 space-y-2">
                          <InfoItem icon={Phone} value={member.phone_number} />
                          <InfoItem icon={CreditCard} value={`ID: ${member.id_number}`} />
                        </div>
                        <div className="col-span-1 flex justify-between md:justify-end items-center gap-4">
                            <div className="text-right">
                                <p className="font-bold text-lg">{member.total_loans}</p>
                                <p className="text-sm text-muted-foreground">Total Loans</p>
                            </div>
                            <Badge variant={member.status === 'active' ? 'default' : 'secondary'} className="capitalize">{member.status}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const InfoItem: React.FC<{ icon: React.ElementType, value: string }> = ({ icon: Icon, value }) => (
    <div className="flex items-center gap-2 text-sm">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span>{value}</span>
    </div>
);

export default SearchMemberPage;