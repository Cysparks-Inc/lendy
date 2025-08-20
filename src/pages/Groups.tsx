import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Search, Edit, Trash2, UsersRound, MapPin, ArrowLeft, Loader2, AlertCircle, Banknote, Landmark, DollarSign, UserCheck, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// --- Interfaces ---
interface Group {
  id: number;
  name: string;
  location?: string;
  branch_id: number;
  branch_name?: string;
  loan_officer_id?: string;
  loan_officer_name?: string;
  member_count: number;
  total_loans: number;
  outstanding_balance: number;
  created_at: string;
}

// --- Reusable Form Component ---
const GroupForm = ({ group, branches, loanOfficers, onSubmit, onCancel, isSubmitting, error }) => {
  const [formData, setFormData] = useState({
    name: group?.name || '',
    location: group?.location || '',
    branch_id: group?.branch_id?.toString() || '',
    loan_officer_id: group?.loan_officer_id || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto px-1">
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      <InputWithLabel id="name" label="Group Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required disabled={isSubmitting} />
      <InputWithLabel id="location" label="Location" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} required disabled={isSubmitting} />
      <SelectWithLabel id="branch_id" label="Branch" placeholder="Select a branch" value={formData.branch_id} onValueChange={v => setFormData({...formData, branch_id: v})} options={branches.map(b => ({ value: String(b.id), label: b.name }))} required disabled={isSubmitting} />
      <SelectWithLabel id="loan_officer_id" label="Loan Officer (Optional)" placeholder="Assign an officer" value={formData.loan_officer_id} onValueChange={v => setFormData({...formData, loan_officer_id: v})} options={loanOfficers.map(o => ({ value: o.id, label: o.full_name }))} disabled={isSubmitting} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{group ? 'Update Group' : 'Create Group'}</Button>
      </DialogFooter>
    </form>
  );
};

// --- Group Profile View ---
const GroupProfile = ({ group, onBack }) => {
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);
  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Back to Groups List</Button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="text-center">
            <div className="w-24 h-24 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
              <UsersRound className="w-12 h-12 text-muted-foreground" />
            </div>
            <CardTitle>{group.name}</CardTitle>
            <CardDescription>{group.location}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-4">
            <InfoItem icon={Landmark} label="Branch" value={group.branch_name} />
            <InfoItem icon={UserCheck} label="Loan Officer" value={group.loan_officer_name} />
          </CardContent>
        </Card>
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Group Summary</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <InfoItem icon={UsersRound} label="Total Members" value={group.member_count} />
              <InfoItem icon={Banknote} label="Active Loans" value={group.total_loans} />
              <InfoItem icon={DollarSign} label="Outstanding Balance" value={formatCurrency(group.outstanding_balance)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// --- Main Groups Page Component ---
const Groups = () => {
  const { isSuperAdmin } = useAuth();
  const [view, setView] = useState<{ page: 'list' | 'profile', data: Group | null }>({ page: 'list', data: null });
  const [groups, setGroups] = useState<Group[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loanOfficers, setLoanOfficers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modal, setModal] = useState<{ type: 'create' | 'edit' | 'delete' | null, data: Group | null }>({ type: null, data: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchGroups(), fetchBranches(), fetchLoanOfficers()]);
      setLoading(false);
    };
    loadData();

    const subscription = supabase.channel('public:groups_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, fetchGroups)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, fetchGroups)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, fetchGroups)
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase.from('groups_with_details').select('*');
      if (error) throw error;
      setGroups(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch groups', { description: error.message });
    }
  };

  const fetchBranches = async () => {
    try {
        const { data, error } = await supabase.from('branches').select('*');
        if (error) throw error;
        setBranches(data || []);
    } catch (error: any) {
        toast.error('Failed to fetch branches', { description: error.message });
    }
  };

  const fetchLoanOfficers = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('id, full_name').eq('role', 'loan_officer');
      if (error) throw error;
      setLoanOfficers(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch loan officers', { description: error.message });
    }
  };

  const handleCreateGroup = async (formData) => {
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const { error } = await supabase.from('groups').insert({ ...formData });
      if (error) throw error;
      toast.success('Group created successfully');
      setModal({ type: null, data: null });
    } catch (error: any) {
      setSubmitError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateGroup = async (formData) => {
    if (!modal.data) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const { error } = await supabase.from('groups').update(formData).eq('id', modal.data.id);
      if (error) throw error;
      toast.success('Group updated successfully');
      setModal({ type: null, data: null });
    } catch (error: any) {
      setSubmitError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!modal.data) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('groups').delete().eq('id', modal.data.id);
      if (error) throw error;
      toast.success('Group deleted successfully');
      setModal({ type: null, data: null });
    } catch (error: any) {
      toast.error('Failed to delete group', { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredGroups = groups.filter(group => {
    const matchesSearch = group.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBranch = branchFilter === 'all' || group.branch_name === branchFilter;
    return matchesSearch && matchesBranch;
  });

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (view.page === 'profile' && view.data) {
    return <div className="p-6"><GroupProfile group={view.data} onBack={() => setView({ page: 'list', data: null })} /></div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Groups Management</h1>

        </div>
        {isSuperAdmin && <Button onClick={() => setModal({ type: 'create', data: null })}><Plus className="h-4 w-4 mr-2" />Add Group</Button>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Groups" value={groups.length} icon={UsersRound} />
        <StatCard title="Total Members" value={groups.reduce((s, g) => s + g.member_count, 0)} icon={UsersRound} />
        <StatCard title="Active Loans" value={groups.reduce((s, g) => s + g.total_loans, 0)} icon={Banknote} />
        <StatCard title="Total Outstanding" value={formatCurrency(groups.reduce((s, g) => s + g.outstanding_balance, 0))} icon={DollarSign} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row justify-between gap-4">
            <div><CardTitle>Groups Directory</CardTitle><CardDescription>A list of all self-help groups.</CardDescription></div>
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
              <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" /></div>
              <Select value={branchFilter} onValueChange={setBranchFilter}><SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Branches" /></SelectTrigger><SelectContent><SelectItem value="all">All Branches</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Group</TableHead><TableHead>Members</TableHead><TableHead>Outstanding</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredGroups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell>
                      <div className="font-medium">{group.name}</div>
                      <div className="text-sm text-muted-foreground">{group.branch_name}</div>
                    </TableCell>
                    <TableCell>{group.member_count}</TableCell>
                    <TableCell className="font-mono">{formatCurrency(group.outstanding_balance)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setView({ page: 'profile', data: group })}><Eye className="h-4 w-4" /></Button>
                        <Button variant="outline" size="sm" onClick={() => setModal({ type: 'edit', data: group })}><Edit className="h-4 w-4" /></Button>
                        <Button variant="destructive" size="sm" onClick={() => setModal({ type: 'delete', data: group })}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* --- Dialogs --- */}
      <Dialog open={modal.type === 'create' || modal.type === 'edit'} onOpenChange={() => setModal({ type: null, data: null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{modal.type === 'edit' ? 'Edit Group' : 'Add New Group'}</DialogTitle></DialogHeader>
          <GroupForm 
            group={modal.data} 
            branches={branches} 
            loanOfficers={loanOfficers}
            onSubmit={modal.type === 'edit' ? handleUpdateGroup : handleCreateGroup} 
            onCancel={() => setModal({ type: null, data: null })}
            isSubmitting={isSubmitting}
            error={submitError}
          />
        </DialogContent>
      </Dialog>
      
      <Dialog open={modal.type === 'delete'} onOpenChange={() => setModal({ type: null, data: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Confirm Deletion</DialogTitle></DialogHeader>
          <p>Are you sure you want to delete the group "{modal.data?.name}"? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal({ type: null, data: null })}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteGroup} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// --- Helper Sub-components ---
const InputWithLabel = ({ id, label, ...props }) => (<div><Label htmlFor={id} className="text-sm font-medium">{label}</Label><Input id={id} className="mt-1" {...props} /></div>);
const SelectWithLabel = ({ id, label, placeholder, options, ...props }) => (<div><Label htmlFor={id}>{label}</Label><Select {...props}><SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent>{options.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select></div>);
const StatCard = ({ title, value, icon: Icon }) => (<Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card>);
const InfoItem = ({ icon: Icon, label, value }) => (<div className="flex items-start gap-3"><Icon className="h-5 w-5 text-muted-foreground mt-1" /><div className="flex flex-col"><Label>{label}</Label><p className="font-medium">{value || 'N/A'}</p></div></div>);

export default Groups;
