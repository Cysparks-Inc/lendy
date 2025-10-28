import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Users as UsersIcon, Loader2, AlertTriangle, Settings, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table'; // Reusable component
import { UserStatusDialog } from '@/components/users/UserStatusDialog';

// --- Type Definitions ---
interface UserSummary {
  id: string;
  email: string;
  full_name: string;
  phone_number?: string;
  role?: string;
  branch_name?: string;
  is_active: boolean;
  deactivated_at?: string;
  deactivated_by?: string;
}

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ElementType }> = ({ title, value, icon: Icon }) => (
  <Card className="bg-gradient-to-br from-brand-blue-50 to-brand-blue-100 border-brand-blue-200 hover:border-brand-blue-300 transition-all duration-200 hover:shadow-md">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-brand-blue-800">{title}</CardTitle>
      <Icon className="h-4 w-4 text-brand-blue-600" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-brand-blue-700">{value}</div>
    </CardContent>
  </Card>
);

const UsersPage: React.FC = () => {
  const { isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteCandidate, setDeleteCandidate] = useState<UserSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // User status management
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [userForStatusChange, setUserForStatusChange] = useState<UserSummary | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch profiles first with branch_id
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (profilesError) throw profilesError;

      // Fetch user roles separately
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      
      if (rolesError) throw rolesError;

      // Create a map of user roles - group all roles per user
      const roleMap = new Map<string, string[]>();
      (rolesData || []).forEach((roleRecord: any) => {
        if (!roleMap.has(roleRecord.user_id)) {
          roleMap.set(roleRecord.user_id, []);
        }
        roleMap.get(roleRecord.user_id)!.push(roleRecord.role);
      });

      // Fetch branches for branch_name
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name');
      
      const branchesMap = new Map((branchesData || []).map(b => [b.id, b.name]));

      // Combine the data - get the primary role (first one) or 'Not Set'
      const formattedUsers = (profilesData || []).map((profile: any) => {
        const roles = roleMap.get(profile.id) || [];
        const primaryRole = roles.length > 0 ? roles[0] : (profile.role || 'Not Set');
        
        // Get branch name using branch_id
        let branchName = null;
        if (profile.branch_id) {
          branchName = branchesMap.get(profile.branch_id) || 'N/A';
        }
        
        return {
          ...profile,
          role: primaryRole,
          branch_name: branchName,
          is_active: !profile.deactivated_at // Check if user is deactivated
        };
      });
      
      setUsers(formattedUsers);
    } catch (error: any) {
      toast.error('Failed to fetch users', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteCandidate) return;
    setIsDeleting(true);
    try {
        // --- This is the definitive call to our Edge Function ---
        const response = await supabase.functions.invoke('delete-user', {
            body: { userId: deleteCandidate.id }
        });

        // Handle network errors (e.g., function not deployed)
        if (response.error) {
            throw new Error(response.error.message);
        }

        const result = response.data;
        // Handle errors from *inside* the function (e.g., bad input)
        if (!result.success) {
            throw new Error(result.error);
        }

        toast.success(`User "${deleteCandidate.full_name}" has been permanently deleted.`);
        setDeleteCandidate(null);
        await fetchUsers(); // Refresh the list
    } catch (error: any) {
        toast.error("Deletion Failed", { 
            description: error.message === "Failed to fetch" ? "The Edge Function may not be deployed correctly. Please check your Supabase dashboard." : error.message 
        });
    } finally {
        setIsDeleting(false);
    }
  };
  
  const columns = [
    { header: 'Name', cell: (row: UserSummary) => <div className="font-medium">{row.full_name}</div> },
    { header: 'Email', cell: (row: UserSummary) => row.email },
    { header: 'Phone', cell: (row: UserSummary) => row.phone_number || <span className="text-muted-foreground">N/A</span> },
    { header: 'Role', cell: (row: UserSummary) => <Badge variant="outline" className="capitalize">{row.role?.replace('_', ' ') || 'Not Set'}</Badge> },
    { header: 'Branch', cell: (row: UserSummary) => row.branch_name || <span className="text-muted-foreground">N/A</span> },
    { header: 'Status', cell: (row: UserSummary) => (
        <div className="flex items-center gap-2">
          <Badge variant={row.is_active ? 'default' : 'secondary'}>
            {row.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      ) 
    },
    { header: 'Actions', cell: (row: UserSummary) => (
        <div className="flex justify-end gap-2">
            <Button asChild variant="outline" size="icon"><Link to={`/users/${row.id}/edit`}><Edit className="h-4 w-4" /></Link></Button>
            <Button asChild variant="outline" size="icon"><Link to={`/users/${row.id}/permissions`}><Shield className="h-4 w-4" /></Link></Button>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => {
                setUserForStatusChange(row);
                setStatusDialogOpen(true);
              }}
              className={row.is_active ? 'text-orange-600 hover:text-orange-700' : 'text-green-600 hover:text-green-700'}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="destructive" size="icon" onClick={() => setDeleteCandidate(row)}><Trash2 className="h-4 w-4" /></Button>
        </div>
    )}
  ];

  if (!isSuperAdmin) {
    return (
        <div className="p-2 sm:p-4 md:p-6">
            <Card className="max-w-md mx-auto">
                <CardHeader className="text-center">
                    <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500" />
                    <CardTitle className="mt-4">Access Denied</CardTitle>
                    <CardDescription>You do not have permission to view this page.</CardDescription>
                </CardHeader>
            </Card>
        </div>
    );
  }

  if (loading) { return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /> </div>; }

  return (
    <div className="space-y-6 p-2 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground">A centralized hub for all system users with granular permission control.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild><Link to="/users/new"><Plus className="h-4 w-4 mr-2" />Add User</Link></Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>System Users ({users.length})</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={columns} data={users} emptyStateMessage="No users found. Click 'Add User' to get started." />
        </CardContent>
      </Card>

      <Dialog open={!!deleteCandidate} onOpenChange={() => setDeleteCandidate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Confirm Permanent Deletion</DialogTitle>
            <DialogDescription className="pt-2">
              Are you sure you want to permanently delete the user <strong>{deleteCandidate?.full_name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setDeleteCandidate(null)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Status Dialog */}
      {userForStatusChange && (
        <UserStatusDialog
          isOpen={statusDialogOpen}
          onClose={() => {
            setStatusDialogOpen(false);
            setUserForStatusChange(null);
          }}
          user={{
            id: userForStatusChange.id,
            full_name: userForStatusChange.full_name,
            email: userForStatusChange.email,
            role: userForStatusChange.role,
            branch_name: userForStatusChange.branch_name,
            is_active: userForStatusChange.is_active
          }}
          onStatusChanged={() => {
            fetchUsers(); // Refresh the users list
          }}
        />
      )}
    </div>
  );
};

export default UsersPage;