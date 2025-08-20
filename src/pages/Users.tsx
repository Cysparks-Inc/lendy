import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UserPlus, Users as UsersIcon, Edit, Trash2, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  full_name: string;
  phone_number?: string;
  role?: string;
  branch_name?: string;
  branch_id?: number;
  created_at?: string;
}

interface Branch {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

const Users = () => {
  const { isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string>('');
  const [submitWarning, setSubmitWarning] = useState<string>('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone_number: '',
    role: '',
    branch_id: ''
  });

  const roles = [
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'branch_admin', label: 'Branch Admin' },
    { value: 'loan_officer', label: 'Loan Officer' },
    { value: 'teller', label: 'Teller' }
  ];

  useEffect(() => {
    fetchUsers();
    fetchBranches();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Query profiles table with branch information - show ALL users
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, email, full_name, phone_number, role, branch_id, created_at,
          branches ( name )
        `)
        .order('full_name', { ascending: true });

      if (error) throw error;

      console.log('Fetched users data:', data); // Debug log

      const formattedUsers = data.map(profile => ({
        ...profile,
        branch_name: (profile.branches as any)?.name,
      }));
      
      console.log('Formatted users:', formattedUsers); // Debug log
      setUsers(formattedUsers);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('name', { ascending: true });
     
      if (error) throw error;
      setBranches(data || []);
    } catch (error: any) {
      console.error('Error fetching branches:', error);
      toast.error('Failed to load branches');
      setBranches([]);
    }
  };

  const validateForm = (isEdit = false) => {
    setSubmitError('');
    setSubmitWarning('');

    if (!formData.email.trim()) {
      setSubmitError('Email address is required.');
      return false;
    }

    if (!isEdit && !formData.password) {
      setSubmitError('Password is required.');
      return false;
    }

    if (!formData.full_name.trim()) {
      setSubmitError('Full name is required.');
      return false;
    }

    if (!formData.role) {
      setSubmitError('Please select a user role.');
      return false;
    }

    if (!formData.branch_id) {
      setSubmitError('Please select a branch.');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setSubmitError('Please enter a valid email address.');
      return false;
    }

    if (!isEdit && formData.password.length < 6) {
      setSubmitError('Password must be at least 6 characters long.');
      return false;
    }

    if (formData.phone_number.trim()) {
      const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
      if (!phoneRegex.test(formData.phone_number.trim())) {
        setSubmitError('Please enter a valid phone number.');
        return false;
      }
    }

    return true;
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
   
    if (isCreating) return;
   
    if (!validateForm()) return;

    setIsCreating(true);
    setSubmitError('');
    setSubmitWarning('');
   
    try {
      const { data: { session } } = await supabase.auth.getSession();
     
      if (!session?.access_token) {
        setSubmitError('Your session has expired. Please log in again.');
        return;
      }

      const response = await supabase.functions.invoke('create-user', {
        body: {
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          userData: {
            full_name: formData.full_name.trim(),
            phone_number: formData.phone_number.trim() || null,
            role: formData.role,
            branchId: parseInt(formData.branch_id)
          }
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      // Better error handling
      if (response.error) {
        console.error('Function invocation error:', response.error);
        throw new Error(response.error.message || 'Failed to create user');
      }

      const result = response.data;

      if (!result) {
        throw new Error('No response received from server');
      }

      if (!result.success) {
        setSubmitError(result.error || 'Unknown error occurred while creating user');
        return;
      }

      if (result.warning) {
        setSubmitWarning(result.warning);
        toast.success('User created successfully!', {
          description: result.warning
        });
        setTimeout(() => setIsDialogOpen(false), 3000);
      } else {
        toast.success('User created successfully! They can now log in with their credentials.');
        setIsDialogOpen(false);
      }
     
      resetForm();
      await fetchUsers();
     
    } catch (error: any) {
      console.error('Error creating user:', error);
     
      let errorMessage = 'An unexpected error occurred. Please try again.';
     
      if (error.message?.includes('Failed to fetch')) {
        errorMessage = 'Unable to connect to the server. Please check your internet connection.';
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'The request timed out. Please try again.';
      } else if (error.message?.includes('401') || error.message?.includes('403')) {
        errorMessage = 'You do not have permission to create users.';
      } else if (error.message && !error.message.includes('Edge Function')) {
        errorMessage = error.message;
      }
     
      setSubmitError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
   
    if (isEditing || !editingUser) return;
   
    if (!validateForm(true)) return;

    setIsEditing(true);
    setSubmitError('');
    setSubmitWarning('');
   
    try {
      // Update profile with role and branch information
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          email: formData.email.trim().toLowerCase(),
          full_name: formData.full_name.trim(),
          phone_number: formData.phone_number.trim() || null,
          role: formData.role,
          branch_id: parseInt(formData.branch_id),
          updated_at: new Date().toISOString()
        })
        .eq('id', editingUser.id);

      if (profileError) throw profileError;

      toast.success('User updated successfully!');
      setIsEditDialogOpen(false);
      resetForm();
      await fetchUsers();
     
    } catch (error: any) {
      console.error('Error updating user:', error);
      setSubmitError(error.message || 'Failed to update user');
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteUser = async () => {
    if (isDeleting || !deletingUser) return;

    setIsDeleting(true);
   
    try {
      // Delete profile (this will cascade delete related records if properly configured)
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', deletingUser.id);

      if (profileError) throw profileError;

      // Delete auth user using edge function
      const { data: { session } } = await supabase.auth.getSession();
     
      if (session?.access_token) {
        // Call delete user function if available
        await supabase.functions.invoke('delete-user', {
          body: { userId: deletingUser.id },
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
      }

      toast.success('User deleted successfully!');
      setIsDeleteDialogOpen(false);
      setDeletingUser(null);
      await fetchUsers();
     
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user: ' + (error.message || 'Unknown error'));
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '', // Don't prefill password
      full_name: user.full_name,
      phone_number: user.phone_number || '',
      role: user.role || '',
      branch_id: user.branch_id?.toString() || ''
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (user: User) => {
    setDeletingUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (submitError) setSubmitError('');
    if (submitWarning) setSubmitWarning('');
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      full_name: '',
      phone_number: '',
      role: '',
      branch_id: ''
    });
    setShowPassword(false);
    setSubmitError('');
    setSubmitWarning('');
    setEditingUser(null);
  };

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) resetForm();
  };

  const handleEditDialogClose = (open: boolean) => {
    setIsEditDialogOpen(open);
    if (!open) resetForm();
  };

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <UsersIcon className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h3>
              <p className="text-gray-600">
                Super admin privileges are required to access user management.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage system users, roles, and permissions
          </p>
        </div>
       
        <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
           
            {submitError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}
           
            {submitWarning && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{submitWarning}</AlertDescription>
              </Alert>
            )}
           
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="user@example.com"
                  required
                  disabled={isCreating}
                />
              </div>
             
              <div>
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder="Minimum 6 characters"
                    required
                    minLength={6}
                    disabled={isCreating}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isCreating}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
             
              <div>
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => handleInputChange('full_name', e.target.value)}
                  placeholder="John Doe"
                  required
                  disabled={isCreating}
                />
              </div>
             
              <div>
                <Label htmlFor="phone_number">Phone Number</Label>
                <Input
                  id="phone_number"
                  type="tel"
                  value={formData.phone_number}
                  onChange={(e) => handleInputChange('phone_number', e.target.value)}
                  placeholder="+1234567890"
                  disabled={isCreating}
                />
              </div>
             
              <div>
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => handleInputChange('role', value)}
                  disabled={isCreating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
             
              <div>
                <Label htmlFor="branch">Branch *</Label>
                <Select
                  value={formData.branch_id}
                  onValueChange={(value) => handleInputChange('branch_id', value)}
                  disabled={isCreating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id.toString()}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
             
              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleDialogClose(false)}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 flex items-center gap-2"
                  disabled={isCreating}
                >
                  {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isCreating ? 'Creating...' : 'Create User'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogClose}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
         
          {submitError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}
         
          <form onSubmit={handleEditUser} className="space-y-4">
            <div>
              <Label htmlFor="edit-email">Email Address *</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                required
                disabled={isEditing}
              />
            </div>
           
            <div>
              <Label htmlFor="edit-full_name">Full Name *</Label>
              <Input
                id="edit-full_name"
                value={formData.full_name}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
                required
                disabled={isEditing}
              />
            </div>
           
            <div>
              <Label htmlFor="edit-phone_number">Phone Number</Label>
              <Input
                id="edit-phone_number"
                type="tel"
                value={formData.phone_number}
                onChange={(e) => handleInputChange('phone_number', e.target.value)}
                disabled={isEditing}
              />
            </div>
           
            <div>
              <Label htmlFor="edit-role">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => handleInputChange('role', value)}
                disabled={isEditing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select user role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
           
            <div>
              <Label htmlFor="edit-branch">Branch *</Label>
              <Select
                value={formData.branch_id}
                onValueChange={(value) => handleInputChange('branch_id', value)}
                disabled={isEditing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id.toString()}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
           
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => handleEditDialogClose(false)}
                disabled={isEditing}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 flex items-center gap-2"
                disabled={isEditing}
              >
                {isEditing && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditing ? 'Updating...' : 'Update User'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirm Deletion
            </DialogTitle>
          </DialogHeader>
         
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to delete this user? This action cannot be undone.
            </p>
           
            {deletingUser && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium">{deletingUser.full_name}</p>
                <p className="text-sm text-muted-foreground">{deletingUser.email}</p>
                {deletingUser.role && (
                  <p className="text-sm text-muted-foreground">Role: {deletingUser.role.replace('_', ' ').toUpperCase()}</p>
                )}
              </div>
            )}
          </div>
         
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="flex items-center gap-2"
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isDeleting ? 'Deleting...' : 'Delete User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            System Users ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading users...</span>
              </div>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <UsersIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">No users found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get started by creating your first user.
              </p>
              <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add First User
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.full_name}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {user.phone_number || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        {user.role ? (
                          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {user.role.replace('_', ' ').toUpperCase()}
                          </div>
                        ) : (
                          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            No Role Assigned
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.branch_name || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteDialog(user)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Users;