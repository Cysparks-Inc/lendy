import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Users as UsersIcon, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table'; // Reusable component

// --- Type Definitions ---
interface UserSummary {
  id: string;
  email: string;
  full_name: string;
  phone_number?: string;
  role?: string;
  branch_name?: string;
}

const UsersPage: React.FC = () => {
  const { isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteCandidate, setDeleteCandidate] = useState<UserSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch profiles and join with the branches table to get the branch name.
      const { data, error } = await supabase.from('profiles').select('*, branch:branches(name)');
      if (error) throw error;
      
      const formattedUsers = data.map(u => ({ ...u, branch_name: u.branch?.name }));
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
    { header: 'Actions', cell: (row: UserSummary) => (
        <div className="flex justify-end gap-2">
            <Button asChild variant="outline" size="icon"><Link to={`/users/${row.id}/edit`}><Edit className="h-4 w-4" /></Link></Button>
            <Button variant="destructive" size="icon" onClick={() => setDeleteCandidate(row)}><Trash2 className="h-4 w-4" /></Button>
        </div>
    )}
  ];

  if (!isSuperAdmin) {
    return (
        <div className="p-6">
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

  if (loading) { return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>; }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground mt-1">A centralized hub for all system users.</p>
        </div>
        <Button asChild><Link to="/users/new"><Plus className="h-4 w-4 mr-2" />Add User</Link></Button>
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
    </div>
  );
};

export default UsersPage;