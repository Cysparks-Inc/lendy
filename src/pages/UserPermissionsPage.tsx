import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';
import { PermissionsForm } from '@/components/users/PermissionsForm';
import { Permission } from '@/config/permissions';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

const UserPermissionsPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);

  useEffect(() => {
    console.log('UserPermissionsPage useEffect triggered', { 
      userId, 
      isSuperAdmin, 
      authLoading 
    });
    
    // Wait for auth to load, then check permissions
    if (authLoading) {
      console.log('Auth still loading, waiting...');
      return;
    }

    if (!isSuperAdmin) {
      console.log('User does not have permission to manage permissions');
      setLoading(false);
      return;
    }

    if (userId) {
      console.log('Fetching user and permissions for userId:', userId);
      fetchUserAndPermissions();
    } else {
      console.log('No userId provided');
      setLoading(false);
    }
  }, [userId, isSuperAdmin, authLoading]);

  const fetchUserAndPermissions = async () => {
    if (!userId) return;
    
    console.log('Starting fetchUserAndPermissions for userId:', userId);
    setLoading(true);
    
    try {
      console.log('Fetching user profile...');
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, is_active')
        .eq('id', userId)
        .single();

      console.log('Profile fetch result:', { profileData, profileError });

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        toast.error('Failed to fetch user profile');
        return;
      }

      if (!profileData) {
        console.log('No profile data found');
        toast.error('User not found');
        return;
      }

      console.log('Setting user data:', profileData);
      setUser(profileData);

      console.log('Fetching user permissions...');
      // Fetch user permissions
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', userId);

      console.log('Permissions fetch result:', { permissionsData, permissionsError });

      if (permissionsError && permissionsError.code !== 'PGRST116') {
        console.error('Permissions fetch error:', permissionsError);
        toast.error('Failed to fetch user permissions');
        return;
      }

      const permissions = permissionsData?.map((p: any) => p.permission as Permission) || [];
      console.log('Setting permissions:', permissions);
      setSelectedPermissions(permissions);
      
    } catch (error: any) {
      console.error('Error in fetchUserAndPermissions:', error);
      toast.error('Error loading user data', { description: error.message });
    } finally {
      console.log('Fetch completed, setting loading to false');
      setLoading(false);
    }
  };

  const handlePermissionChange = (permission: Permission, checked: boolean) => {
    setSelectedPermissions(prev => 
      checked ? [...prev, permission] : prev.filter(p => p !== permission)
    );
  };

  const handleSavePermissions = async () => {
    if (!userId) return;
    
    console.log('Starting save permissions for userId:', userId);
    setSaving(true);
    
    try {
      // Get current user data first
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      console.log('Current user:', currentUser?.id);
      
      // Delete existing permissions
      console.log('Deleting existing permissions...');
      const { error: deleteError } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        throw new Error('Failed to clear existing permissions');
      }

      // Insert new permissions
      if (selectedPermissions.length > 0) {
        console.log('Inserting new permissions:', selectedPermissions);
        const newPermissions = selectedPermissions.map(permission => ({
          user_id: userId,
          permission,
          created_by: currentUser?.id
        }));

        const { error: insertError } = await supabase
          .from('user_permissions')
          .insert(newPermissions);

        if (insertError) {
          console.error('Insert error:', insertError);
          throw new Error('Failed to save new permissions');
        }
      }

      console.log('Permissions saved successfully');
      toast.success('User permissions updated successfully!');
      navigate('/users');
    } catch (error: any) {
      console.error('Save permissions error:', error);
      toast.error('Failed to save permissions', { description: error.message });
    } finally {
      setSaving(false);
    }
  };
  
  // Check permissions first
  if (!authLoading && !isSuperAdmin) {
    return (
      <div className="p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to manage user permissions.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (loading || authLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle>User Not Found</CardTitle>
            <CardDescription>The requested user could not be found.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/users')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Manage User Permissions</h1>
          <p className="text-muted-foreground">Configure specific permissions for this user</p>
        </div>
      </div>

      {/* User Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>{user.full_name}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                {user.email}
                <Badge variant={user.is_active ? 'default' : 'secondary'}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {user.role.replace('_', ' ')}
                </Badge>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Permissions Form */}
      <Card>
        <CardHeader>
          <CardTitle>User Permissions</CardTitle>
          <CardDescription>
            Select the specific actions this user is allowed to perform. Super admins automatically have all permissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PermissionsForm
            selectedPermissions={selectedPermissions}
            onChange={handlePermissionChange}
            disabled={user.role === 'super_admin'}
          />
          
          {user.role === 'super_admin' && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Super administrators automatically have all permissions and cannot be restricted.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate('/users')}>
          Cancel
        </Button>
        <Button 
          onClick={handleSavePermissions} 
          disabled={saving || user.role === 'super_admin'}
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" />
          Save Permissions
        </Button>
      </div>
    </div>
  );
};

export default UserPermissionsPage;