import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Users,
  UserPlus,
  X,
  Loader2,
  AlertCircle,
  Search
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
}

interface GroupMember {
  id: string;
  full_name: string;
  id_number: string;
  phone_number: string;
  email: string;
  status: string;
  total_loans: number;
  active_loans: number;
  total_outstanding: number;
  last_loan_date: string;
  member_since: string;
  monthly_income: number;
  profession: string;
  address: string;
  branch_id?: number;
}

const GroupMembers: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // State
  const [group, setGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [availableMembers, setAvailableMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isManagingMembers, setIsManagingMembers] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch group data and members
  const fetchData = async () => {
    if (!groupId) return;
    
    try {
      setLoading(true);
      
      // Fetch group details
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();
      
      if (groupError) throw groupError;
      setGroup(groupData);
      
      // Fetch group members
      await fetchGroupMembers(groupData);
      
      // Fetch available members
      await fetchAvailableMembers(groupData);
      
    } catch (error: any) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load group data');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupMembers = async (groupData: Group) => {
    try {
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('*')
        .eq('group_id', groupData.id);
      
      if (membersError) throw membersError;
      
      // Fetch loans for these members
      const memberIds = membersData?.map(m => m.id) || [];
      let loansData: any[] = [];
      
      if (memberIds.length > 0) {
        const { data: loans, error: loansError } = await supabase
          .from('loans')
          .select('id, customer_id, principal_amount, due_date, current_balance, status, loan_officer_id, created_at')
          .in('customer_id', memberIds);
        
        if (!loansError) {
          loansData = loans || [];
        }
      }
      
      const membersWithData = membersData?.map(member => {
        const memberLoans = loansData.filter(loan => loan.customer_id === member.id);
        const activeLoans = memberLoans.filter(loan => 
          loan.status === 'active' || loan.status === 'overdue'
        );
        
        const totalOutstanding = activeLoans.reduce((sum, loan) => 
          sum + parseFloat(loan.current_balance || '0'), 0
        );
        
        const lastLoan = memberLoans.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        
        return {
          ...member,
          total_loans: memberLoans.length,
          active_loans: activeLoans.length,
          total_outstanding: totalOutstanding,
          last_loan_date: lastLoan?.created_at || 'Never',
          member_since: member.created_at
        };
      }) || [];
      
      setGroupMembers(membersWithData);
      
    } catch (error: any) {
      console.error('Failed to fetch group members:', error);
      toast.error('Failed to load group members');
    }
  };

  const fetchAvailableMembers = async (groupData: Group) => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .is('group_id', null)
        .eq('branch_id', groupData.branch_id);
      
      if (error) throw error;
      setAvailableMembers(data || []);
      
    } catch (error: any) {
      console.error('Failed to fetch available members:', error);
    }
  };

  // Handle adding members to group
  const handleAddMembersToGroup = async () => {
    if (selectedMembers.length === 0 || !group) return;
    
    setIsManagingMembers(true);
    try {
      const { error } = await supabase
        .from('members')
        .update({ group_id: group.id })
        .in('id', selectedMembers)
        .select();
      
      if (error) throw error;
      
      toast.success(`${selectedMembers.length} member(s) added to group`);
      setSelectedMembers([]);
      await fetchGroupMembers(group);
      await fetchAvailableMembers(group);
    } catch (error: any) {
      console.error('Failed to add members to group:', error);
      toast.error('Failed to add members to group');
    } finally {
      setIsManagingMembers(false);
    }
  };

  // Handle removing member from group
  const handleRemoveMemberFromGroup = async (memberId: string) => {
    if (!group) return;
    
    try {
      const { error } = await supabase
        .from('members')
        .update({ group_id: null })
        .eq('id', memberId)
        .select();
      
      if (error) throw error;
      
      toast.success('Member removed from group');
      await fetchGroupMembers(group);
      await fetchAvailableMembers(group);
    } catch (error: any) {
      console.error('Failed to remove member from group:', error);
      toast.error('Failed to remove member from group');
    }
  };

  // Handle member selection
  const handleMemberSelection = (memberId: string) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  // Filter available members based on search
  const filteredAvailableMembers = availableMembers.filter(member =>
    member.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.id_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.phone_number.includes(searchTerm)
  );

  useEffect(() => {
    fetchData();
  }, [groupId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Group Not Found</h2>
          <p className="text-muted-foreground">The requested group could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          onClick={() => navigate(`/groups/${groupId}`)}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Group
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Members</h1>
          <p className="text-muted-foreground">{group.name} - Member Management</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Available Members */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Available Members
                </CardTitle>
                <CardDescription>
                  Add members to this group
                </CardDescription>
              </div>
              <Badge variant="secondary">{availableMembers.length} available</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Members List */}
            <div className="max-h-96 overflow-y-auto space-y-2">
              {filteredAvailableMembers.length > 0 ? (
                filteredAvailableMembers.map(member => (
                  <div 
                    key={member.id} 
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleMemberSelection(member.id)}
                  >
                    <Checkbox
                      checked={selectedMembers.includes(member.id)}
                      onChange={() => {}}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{member.full_name}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {member.id_number} • {member.phone_number}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {member.profession} • {member.monthly_income ? `$${member.monthly_income.toLocaleString()}/month` : 'No income data'}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="mx-auto h-12 w-12 mb-4" />
                  <p className="text-sm">No available members to add</p>
                  <p className="text-xs">All members are already assigned to groups</p>
                </div>
              )}
            </div>
            
            {/* Add Button */}
            <Button 
              onClick={handleAddMembersToGroup}
              disabled={selectedMembers.length === 0 || isManagingMembers}
              className="w-full"
            >
              {isManagingMembers ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              Add {selectedMembers.length} Member(s) to Group
            </Button>
          </CardContent>
        </Card>

        {/* Current Group Members */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Current Members
                </CardTitle>
                <CardDescription>
                  Members currently in this group
                </CardDescription>
              </div>
              <Badge variant="secondary">{groupMembers.length} members</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {groupMembers.length > 0 ? (
                groupMembers.map(member => (
                  <div 
                    key={member.id} 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Users className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{member.full_name}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {member.id_number} • {member.phone_number}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {member.profession} • {member.monthly_income ? `$${member.monthly_income.toLocaleString()}/month` : 'No income data'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {member.active_loans} active loans • {member.total_outstanding > 0 ? `$${member.total_outstanding.toLocaleString()} outstanding` : 'No outstanding loans'}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveMemberFromGroup(member.id)}
                      disabled={isManagingMembers}
                      className="flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="mx-auto h-12 w-12 mb-4" />
                  <p className="text-sm">No members in this group</p>
                  <p className="text-xs">Use the left panel to add members</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GroupMembers;


