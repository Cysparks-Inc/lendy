import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Edit, Trash2, Users, Eye, Banknote, DollarSign, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table'; // We will use our new reusable component

// --- Type Definitions ---
// This type matches the output of our secure database function
interface MemberSummary {
  id: string;
  full_name: string;
  id_number: string;
  phone_number: string;
  status: string;
  branch_name: string;
  total_loans: number;
  outstanding_balance: number;
}

const MembersPage: React.FC = () => {
  const { user, userRole } = useAuth();
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [deleteCandidate, setDeleteCandidate] = useState<MemberSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Fetch members when the component mounts or the user changes
  useEffect(() => {
    if (user) {
      fetchMembers();
    }
  }, [user]);

  const fetchMembers = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Single, secure RPC call. The database handles all filtering based on the user's role.
      const { data, error } = await supabase.rpc('get_members_for_user', { requesting_user_id: user.id });
      if (error) throw error;
      setMembers(data as MemberSummary[] || []);
    } catch (error: any) {
      toast.error('Failed to fetch members', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!deleteCandidate) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('members').delete().eq('id', deleteCandidate.id);
      if (error) throw error;
      toast.success(`Member "${deleteCandidate.full_name}" deleted successfully.`);
      setDeleteCandidate(null);
      await fetchMembers(); // Refresh the list
    } catch (error: any) {
      toast.error('Failed to delete member', { description: error.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredMembers = members.filter(member =>
    member.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (member.id_number && member.id_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (member.phone_number && member.phone_number.includes(searchTerm))
  );

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);

  // --- DataTable Column Definitions ---
  const columns = [
    {
        header: 'Member',
        cell: (row: MemberSummary) => (
            <div>
                <div className="font-medium">{row.full_name}</div>
                <div className="text-sm text-muted-foreground">{row.branch_name}</div>
            </div>
        )
    },
    {
        header: 'Contact',
        cell: (row: MemberSummary) => (
            <div>
                <div className="font-medium">{row.phone_number}</div>
                <div className="text-sm text-muted-foreground">ID: {row.id_number}</div>
            </div>
        )
    },
    {
        header: 'Financials',
        cell: (row: MemberSummary) => (
            <div>
                <div><span className="font-semibold">Loans:</span> {row.total_loans}</div>
                <div className="text-sm text-muted-foreground">Outstanding: {formatCurrency(row.outstanding_balance)}</div>
            </div>
        )
    },
    {
        header: 'Actions',
        cell: (row: MemberSummary) => (
            <div className="flex justify-end gap-2">
                <Button asChild variant="outline" size="icon"><Link to={`/members/${row.id}`}><Eye className="h-4 w-4" /></Link></Button>
                <Button asChild variant="outline" size="icon"><Link to={`/members/${row.id}/edit`}><Edit className="h-4 w-4" /></Link></Button>
                {userRole === 'super_admin' && (
                    <Button variant="destructive" size="icon" onClick={() => setDeleteCandidate(row)}><Trash2 className="h-4 w-4" /></Button>
                )}
            </div>
        )
    }
  ];

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Members Management</h1>
          <p className="text-muted-foreground">Your centralized hub for all member data.</p>
        </div>
        <Button asChild>
          <Link to="/members/new"><Plus className="h-4 w-4 mr-2" />Add Member</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Total Members" value={members.length} icon={Users} />
        <StatCard title="Active Members" value={members.filter(m => m.status === 'active').length} icon={Users} />
        <StatCard title="Total Loans Issued" value={members.reduce((sum, m) => sum + (m.total_loans || 0), 0)} icon={Banknote} />
        <StatCard title="Total Outstanding" value={formatCurrency(members.reduce((sum, m) => sum + (m.outstanding_balance || 0), 0))} icon={DollarSign} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div><CardTitle>Members Directory</CardTitle><CardDescription>Showing {filteredMembers.length} of {members.length} members.</CardDescription></div>
            <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by name, ID, or phone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" /></div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filteredMembers}
            emptyStateMessage="No members match your search criteria."
          />
        </CardContent>
      </Card>
      
      <Dialog open={!!deleteCandidate} onOpenChange={() => setDeleteCandidate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Confirm Deletion</DialogTitle></DialogHeader>
          <p>Are you sure you want to permanently delete "<strong>{deleteCandidate?.full_name}</strong>"? This will erase all their associated loans and payments. This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCandidate(null)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteMember} disabled={isDeleting}>{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete Member</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ElementType }> = ({ title, value, icon: Icon }) => (
    <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card>
);

export default MembersPage;