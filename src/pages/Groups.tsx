import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus,
  Search,
  Calendar,
  Building2,
  Users,
  Eye,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
interface Group {
  id: number;
  name: string;
  description: string;
  branch_id: number;
  meeting_day: number;
  created_at: string;
  branch_name?: string;
  member_count?: number;
}

interface Branch {
  id: number;
  name: string;
  location: string;
}

const Groups: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  
  // State
  const [groups, setGroups] = useState<Group[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');

  // Fetch data on component mount
  useEffect(() => {
    const initializeData = async () => {
      if (!user || !profile) return;
      
      try {
        setLoading(true);
        
        // Fetch branches
        const { data: branchesData, error: branchesError } = await supabase
          .from('branches')
          .select('*')
          .order('name');
        
        if (branchesError) throw branchesError;
        setBranches(branchesData || []);
        
        // Fetch groups with branch information
        const { data: groupsData, error: groupsError } = await supabase
          .from('groups')
          .select(`
            *,
            branches!inner(name)
          `)
          .order('name');
        
        if (groupsError) throw groupsError;
        
        // Transform the data to match our interface
        const transformedGroups = (groupsData || []).map(group => ({
          ...group,
          branch_name: group.branches?.name || 'Unknown Branch'
        }));
        
        setGroups(transformedGroups);
        
      } catch (error: any) {
        console.error('Failed to initialize data:', error);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, [user, profile]);

  // Filtered data - Improved filtering with cascading logic
  const filteredGroups = groups.filter(group => {
    const searchMatch = (group.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                       (group.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                       (group.branch_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const branchMatch = branchFilter === 'all' || !branchFilter || group.branch_id?.toString() === branchFilter;
    const dayMatch = dayFilter === 'all' || !dayFilter || group.meeting_day?.toString() === dayFilter;
    
    return searchMatch && branchMatch && dayMatch;
  });

  // Get available groups based on current filters
  const availableGroups = filteredGroups.filter(group => {
    // If day filter is set, only show groups for that day
    if (dayFilter && dayFilter !== 'all') {
      return group.meeting_day?.toString() === dayFilter;
    }
    return true;
  });

  // Get groups to display based on current filters
  const displayGroups = (() => {
    if (dayFilter && dayFilter !== 'all') {
      // If day is selected, show groups for that day
      if (branchFilter && branchFilter !== 'all') {
        // If both day and branch are selected, show groups for that day and branch
        return availableGroups.filter(group => group.branch_id?.toString() === branchFilter);
      } else {
        // If only day is selected, show all groups for that day
        return availableGroups;
      }
    } else {
      // If no day is selected, show all groups
      return filteredGroups;
    }
  })();

  // Helper function for currency formatting
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', { 
      style: 'currency', 
      currency: 'KES' 
    }).format(amount || 0);
  };

  // Helper function to get day name from meeting day number
  const getDayName = (dayNumber: number) => {
    const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[dayNumber] || 'Unknown';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Group Transaction Sheet</h1>
          <p className="text-muted-foreground">View and manage groups</p>
        </div>
        <Button onClick={() => navigate('/groups/create')}>
          <Plus className="mr-2 h-4 w-4" />
          Create Group
        </Button>
      </div>

      {/* Main Content - AMBS Style Group Transaction Sheet */}
      <div className="space-y-6">
        {/* Improved Filter Controls - Horizontal Layout */}
        <div className="bg-white border rounded-lg shadow-sm p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-gray-500" />
                <h3 className="text-lg font-medium text-gray-900">Meeting Day:</h3>
              </div>
              <Select value={dayFilter} onValueChange={setDayFilter}>
                <SelectTrigger className="h-10 border-gray-300 bg-white w-40">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All days</SelectItem>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="2">Tuesday</SelectItem>
                  <SelectItem value="3">Wednesday</SelectItem>
                  <SelectItem value="4">Thursday</SelectItem>
                  <SelectItem value="5">Friday</SelectItem>
                  <SelectItem value="6">Saturday</SelectItem>
                  <SelectItem value="7">Sunday</SelectItem>
                </SelectContent>
              </Select>
              
              {dayFilter && dayFilter !== 'all' && (
                <>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-gray-500" />
                    <h3 className="text-lg font-medium text-gray-900">Branch:</h3>
                  </div>
                  <Select value={branchFilter} onValueChange={setBranchFilter}>
                    <SelectTrigger className="h-10 border-gray-300 bg-white w-40">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All branches</SelectItem>
                      {branches.map(branch => (
                        <SelectItem key={branch.id} value={branch.id.toString()}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-gray-500" />
                <h3 className="text-lg font-medium text-gray-900">Search:</h3>
              </div>
              <Input
                placeholder="Search groups by name, description, or branch..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 border-gray-300 bg-white w-80"
              />
            </div>
          </div>
        </div>

        {/* Groups Display */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {dayFilter && dayFilter !== 'all' 
                ? `${getDayName(parseInt(dayFilter))} Groups`
                : 'All Groups'
              }
              {branchFilter && branchFilter !== 'all' && (
                <span className="text-gray-600 ml-2">
                  • {branches.find(b => b.id.toString() === branchFilter)?.name}
                </span>
              )}
            </h2>
            <Badge variant="secondary">
              {displayGroups.length} group{displayGroups.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          {displayGroups.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayGroups.map(group => (
                <Card key={group.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{group.name}</CardTitle>
                        <CardDescription className="text-sm">
                          {group.description || 'No description'}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {getDayName(group.meeting_day)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Building2 className="h-4 w-4" />
                      <span>{group.branch_name}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="h-4 w-4" />
                      <span>{group.member_count || 0} members</span>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => navigate(`/groups/${group.id}`)}
                        className="flex-1"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/groups/${group.id}/edit`)}
                      >
                        <Building2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/groups/${group.id}/members`)}
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Users className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No groups found</h3>
              <p className="text-gray-500">
                {searchTerm || dayFilter !== 'all' || branchFilter !== 'all'
                  ? 'Try adjusting your filters or search terms.'
                  : 'No groups have been created yet.'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Groups;