import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft, 
  Building2,
  Loader2,
  AlertCircle,
  Save
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
  contact_person_id?: string;
}

interface Branch {
  id: number;
  name: string;
  location: string;
}

interface Member {
  id: string;
  full_name: string;
  phone_number: string;
}

interface LoanOfficer {
  id: string;
  full_name: string;
  email: string;
}

const GroupEdit: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Check if we're creating a new group or editing an existing one
  // Treat absence of groupId (route /groups/new) or explicit 'new' as create mode
  const isCreating = !groupId || groupId === 'new';
  
  // State
  const [group, setGroup] = useState<Group | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [groupMembers, setGroupMembers] = useState<Member[]>([]);
  const [loanOfficers, setLoanOfficers] = useState<LoanOfficer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    branch_id: '',
    meeting_day: 1,
    meeting_time: '',
    location: '',
    contact_person_id: '',
    assigned_officer_id: ''
  });

  // Fetch group members for contact person selection
  const fetchGroupMembers = async (groupId: string) => {
    try {
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('id, full_name, phone_number')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .order('full_name');
      
      if (membersError) throw membersError;
      setGroupMembers(membersData || []);
    } catch (error: any) {
      console.error('Failed to fetch group members:', error);
      setGroupMembers([]);
    }
  };

  // Fetch group data and branches
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch branches first (needed for both create and edit)
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('*')
        .order('name');
      
      if (branchesError) throw branchesError;
      setBranches(branchesData || []);

      // Fetch all members for new group creation (no restriction)
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('id, full_name, phone_number')
        .eq('status', 'active')
        .order('full_name');
      
      if (membersError) throw membersError;
      setMembers(membersData || []);

      // Fetch loan officers for assignment
      const { data: officersData, error: officersError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'loan_officer')
        .order('full_name');
      
      if (officersError) throw officersError;
      setLoanOfficers(officersData || []);
      
      // If we're creating a new group, we don't need to fetch group data
      if (isCreating) {
        setLoading(false);
        return;
      }
      
      // If we're editing, fetch the group details
      if (!groupId) return;
      
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();
      
      if (groupError) throw groupError;
      setGroup(groupData);
      
      // Fetch group members for contact person selection
      await fetchGroupMembers(groupId);
      
      // Set form data
      setFormData({
        name: groupData.name,
        description: groupData.description || '',
        branch_id: groupData.branch_id.toString(),
        meeting_day: groupData.meeting_day || 1,
        meeting_time: groupData.meeting_time || '',
        location: groupData.location || '',
        contact_person_id: groupData.contact_person_id || '',
        assigned_officer_id: (groupData as any).assigned_officer_id || ''
      });
      
    } catch (error: any) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load group data');
    } finally {
      setLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.branch_id) {
      toast.error('Branch selection is required');
      return;
    }

    // Validate contact person is a member of the group (only when editing)
    if (!isCreating && formData.contact_person_id && formData.contact_person_id !== 'none') {
      const isContactPersonInGroup = groupMembers.some(member => member.id === formData.contact_person_id);
      if (!isContactPersonInGroup) {
        toast.error('Selected contact person must be a member of this group');
        return;
      }
    }
    
    setIsSubmitting(true);
    try {
      const submitData: any = {
        name: formData.name,
        description: formData.description,
        branch_id: parseInt(formData.branch_id),
        meeting_day: formData.meeting_day,
        // Allow null for optional meeting_time to avoid DB errors on empty string
        meeting_time: formData.meeting_time && formData.meeting_time.trim() !== '' ? formData.meeting_time : null,
        location: formData.location,
        contact_person_id: formData.contact_person_id === 'none' ? null : formData.contact_person_id || null
      };

      // Only include assigned_officer_id if it's not 'none' and not empty
      if (formData.assigned_officer_id && formData.assigned_officer_id !== 'none') {
        submitData.assigned_officer_id = formData.assigned_officer_id;
      }
      
      if (isCreating) {
        // Create new group (only include columns that exist in schema)
        const { data, error } = await supabase
          .from('groups')
          .insert([submitData])
          .select()
          .single();
        
        if (error) {
          // If assigned_officer_id column doesn't exist, try without it
          if (error.code === 'PGRST204' && error.message.includes('assigned_officer_id')) {
            const { assigned_officer_id, ...dataWithoutOfficer } = submitData;
            const { data: retryData, error: retryError } = await supabase
              .from('groups')
              .insert([dataWithoutOfficer])
              .select()
              .single();
            
            if (retryError) throw retryError;
            
            toast.success('Group created successfully (loan officer assignment not available)');
            navigate(`/groups/${retryData.id}`);
            return;
          }
          throw error;
        }
        
        toast.success('Group created successfully');
        navigate(`/groups/${data.id}`);
      } else {
        // Update existing group
        if (!groupId) return;
        
        const { error } = await supabase
          .from('groups')
          .update(submitData)
          .eq('id', groupId);
        
        if (error) {
          // If assigned_officer_id column doesn't exist, try without it
          if (error.code === 'PGRST204' && error.message.includes('assigned_officer_id')) {
            const { assigned_officer_id, ...dataWithoutOfficer } = submitData;
            const { error: retryError } = await supabase
              .from('groups')
              .update(dataWithoutOfficer)
              .eq('id', groupId);
            
            if (retryError) throw retryError;
            
            toast.success('Group updated successfully (loan officer assignment not available)');
            navigate(`/groups/${groupId}`);
            return;
          }
          throw error;
        }
        
        toast.success('Group updated successfully');
        navigate(`/groups/${groupId}`);
      }
      
    } catch (error: any) {
      console.error(`Failed to ${isCreating ? 'create' : 'update'} group:`, error);
      toast.error(`Failed to ${isCreating ? 'create' : 'update'} group`);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [groupId, isCreating]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!group && !isCreating) {
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
    <div className="container mx-auto px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Button
          variant="outline"
          onClick={() => navigate('/groups')}
          className="flex items-center gap-2 w-full sm:w-auto"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Groups
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            {isCreating ? 'Create New Group' : 'Edit Group'}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {isCreating ? 'Add a new group to the system' : 'Update group information'}
          </p>
        </div>
      </div>

      {/* Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Group Information
          </CardTitle>
          <CardDescription>
            Update the group details below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Group Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Enter group name"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="branch_id">Branch *</Label>
                <Select value={formData.branch_id} onValueChange={(value) => setFormData({...formData, branch_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(branch => (
                      <SelectItem key={branch.id} value={branch.id.toString()}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Enter group description"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="meeting_day">Meeting Day</Label>
              <Select value={formData.meeting_day.toString()} onValueChange={(value) => setFormData({...formData, meeting_day: parseInt(value)})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="2">Tuesday</SelectItem>
                  <SelectItem value="3">Wednesday</SelectItem>
                  <SelectItem value="4">Thursday</SelectItem>
                  <SelectItem value="5">Friday</SelectItem>
                  <SelectItem value="6">Saturday</SelectItem>
                  <SelectItem value="7">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="meeting_time">Meeting Time</Label>
              <Input
                id="meeting_time"
                type="time"
                value={formData.meeting_time}
                onChange={(e) => setFormData({...formData, meeting_time: e.target.value})}
                placeholder="Enter meeting time"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                placeholder="Enter meeting location"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="contact_person_id">Contact Person (Optional)</Label>
                {!isCreating && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => groupId && fetchGroupMembers(groupId)}
                    className="text-xs"
                  >
                    Refresh Members
                  </Button>
                )}
              </div>
              <Select value={formData.contact_person_id} onValueChange={(value) => setFormData({...formData, contact_person_id: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a contact person" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No contact person</SelectItem>
                  {(isCreating ? members : groupMembers).map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name} - {member.phone_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isCreating && groupMembers.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No members in this group yet. Add members to the group first before selecting a contact person.
                </p>
              )}
              {!isCreating && groupMembers.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Only group members can be selected as contact person. ({groupMembers.length} member{groupMembers.length !== 1 ? 's' : ''} available)
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="assigned_officer_id">Assigned Loan Officer (Optional)</Label>
              <Select value={formData.assigned_officer_id} onValueChange={(value) => setFormData({...formData, assigned_officer_id: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a loan officer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No assigned officer</SelectItem>
                  {loanOfficers.map((officer) => (
                    <SelectItem key={officer.id} value={officer.id}>
                      {officer.full_name} - {officer.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/groups')}
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isCreating ? 'Create Group' : 'Update Group'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default GroupEdit;


