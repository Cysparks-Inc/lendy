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
}

interface Branch {
  id: number;
  name: string;
  location: string;
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
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    branch_id: '',
    meeting_day: 1
  });

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
      
      // Set form data
      setFormData({
        name: groupData.name,
        description: groupData.description || '',
        branch_id: groupData.branch_id.toString(),
        meeting_day: groupData.meeting_day || 1
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
    
    setIsSubmitting(true);
    try {
      const submitData = {
        name: formData.name,
        description: formData.description,
        branch_id: parseInt(formData.branch_id),
        meeting_day: formData.meeting_day
      };
      
      if (isCreating) {
        // Create new group (only include columns that exist in schema)
        const { data, error } = await supabase
          .from('groups')
          .insert([submitData])
          .select()
          .single();
        
        if (error) throw error;
        
        toast.success('Group created successfully');
        navigate(`/groups/${data.id}`);
      } else {
        // Update existing group
        if (!groupId) return;
        
        const { error } = await supabase
          .from('groups')
          .update(submitData)
          .eq('id', groupId);
        
        if (error) throw error;
        
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


