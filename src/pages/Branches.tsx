import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Search, Edit, Trash2, Building, Users, CreditCard, DollarSign, Loader2, AlertCircle, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table';

// --- Type Definitions ---
interface Branch {
  id: number;
  name: string;
  location: string;
  created_at: string;
  member_count: number;
  loan_count: number;
  total_outstanding: number;
  total_loans?: number; // Added for new summary cards
  total_portfolio?: number; // Added for new summary cards
}

const Branches: React.FC = () => {
  const { userRole } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  // --- UI/UX UPGRADE: State for the delete confirmation dialog ---
  const [deleteCandidate, setDeleteCandidate] = useState<Branch | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({ name: '', location: '' });

  useEffect(() => {
    if (userRole === 'super_admin') {
      fetchBranches();
    } else {
      setLoading(false);
    }
  }, [userRole]);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_branch_stats');
      if (error) throw error;
      setBranches(data || []);
    } catch (error: any) {
      toast.error('Failed to load branches', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingBranch) {
        const { error } = await supabase.from('branches').update(formData).eq('id', editingBranch.id);
        if (error) throw error;
        toast.success(`Branch "${formData.name}" updated successfully.`);
      } else {
        const { error } = await supabase.from('branches').insert(formData);
        if (error) throw error;
        toast.success(`Branch "${formData.name}" created successfully.`);
      }
      closeDialog();
      await fetchBranches();
    } catch (error: any) {
      toast.error(`Operation failed`, { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // --- UI/UX UPGRADE: New handler for the confirmation dialog ---
  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    setIsDeleting(true);
    try {
        const { error } = await supabase.from('branches').delete().eq('id', deleteCandidate.id);
        if (error) throw error;
        toast.success(`Branch "${deleteCandidate.name}" deleted successfully.`);
        setDeleteCandidate(null);
        await fetchBranches();
    } catch(error: any) {
        toast.error("Deletion failed", { description: "You may need to reassign or delete members and loans from this branch first." });
    } finally {
        setIsDeleting(false);
    }
  };

  const openDialog = (branch: Branch | null = null) => {
    setEditingBranch(branch);
    setFormData(branch ? { name: branch.name, location: branch.location } : { name: '', location: '' });
    setDialogOpen(true);
  };
  
  const closeDialog = () => {
    setDialogOpen(false);
    setEditingBranch(null);
    setFormData({ name: '', location: '' });
  };

  const filteredBranches = branches.filter(branch =>
    branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);

  const columns = [
    { header: 'Branch', cell: (row: Branch) => <div><p className="font-medium">{row.name}</p><p className="text-xs text-muted-foreground">ID: {row.id}</p></div> },
    { header: 'Location', cell: (row: Branch) => row.location || 'N/A' },
    { header: 'Members', cell: (row: Branch) => <div className="text-center">{row.member_count}</div> },
    { header: 'Active Loans', cell: (row: Branch) => <div className="text-center">{row.loan_count}</div> },
    { header: 'Total Outstanding', cell: (row: Branch) => <div className="font-mono text-right">{formatCurrency(row.total_outstanding)}</div> },
    { 
      header: 'Actions', 
      cell: (row: Branch) => (
        <div className="flex justify-end gap-2">
            {/* --- THE CRITICAL FIX: Added onClick handlers --- */}
            <Button variant="outline" size="icon" onClick={() => openDialog(row)}>
                <Edit className="h-4 w-4" />
            </Button>
            <Button variant="destructive" size="icon" onClick={() => setDeleteCandidate(row)}>
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
      )
    },
  ];

  if (loading) { return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>; }

  if (userRole !== 'super_admin') {
    return (
      <div className="p-2 sm:p-4 md:p-6"><Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-yellow-500" />
          <CardTitle className="mt-4">Access Denied</CardTitle>
          <CardDescription>Only Super Admins can manage branches.</CardDescription>
        </CardHeader>
      </Card></div>
    );
  }

  return (
    <>
      <div className="space-y-6 p-2 sm:p-4 md:p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Branch Management</h1>
            <p className="text-muted-foreground mt-1">Manage branch locations and their operations.</p>
          </div>
          <Button onClick={() => openDialog()}><Plus className="h-4 w-4 mr-2" />New Branch</Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2"><Building className="h-4 w-4 text-muted-foreground" />Total Branches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{branches.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" />Total Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{branches.reduce((sum, b) => sum + (b.member_count || 0), 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2"><CreditCard className="h-4 w-4 text-muted-foreground" />Total Loans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{branches.reduce((sum, b) => sum + (b.total_loans || 0), 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2"><DollarSign className="h-4 w-4 text-muted-foreground" />Total Portfolio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(branches.reduce((sum, b) => sum + (b.total_portfolio || 0), 0))}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Branches</CardTitle>
              <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search branches..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" /></div>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable columns={columns} data={filteredBranches} emptyStateMessage="No branches found matching your criteria." />
          </CardContent>
        </Card>
      </div>

      {/* --- UI/UX UPGRADE: Replaced old modal with two distinct dialogs --- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBranch ? 'Edit Branch' : 'Create New Branch'}</DialogTitle>
            <DialogDescription>{editingBranch ? 'Update the details for this branch.' : 'Add a new branch location to the system.'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4 pt-4">
            <div>
              <Label htmlFor="name">Branch Name</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g., Nairobi Central" required />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input id="location" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} placeholder="e.g., CBD, Nairobi" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingBranch ? 'Save Changes' : 'Create Branch'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!deleteCandidate} onOpenChange={() => setDeleteCandidate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>Are you sure you want to delete the branch: <strong>{deleteCandidate?.name}</strong>? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setDeleteCandidate(null)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const StatCard: React.FC<{title: string, value: string | number, icon: React.ElementType}> = ({ title, value, icon: Icon }) => (
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" />{title}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card>
);

export default Branches;