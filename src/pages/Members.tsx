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
import { Plus, Search, Edit, Trash2, Users, Eye, Phone, MapPin, ArrowLeft, Loader2, AlertCircle, Banknote, Landmark, DollarSign, Hash } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// --- Interfaces ---
interface Member {
  id: string;
  full_name: string;
  id_number: string;
  phone_number: string;
  address?: string;
  status: string;
  group_id?: number;
  branch_id?: number;
  next_of_kin_name?: string;
  next_of_kin_phone?: string;
  notes?: string;
  created_at: string;
  group_name?: string;
  branch_name?: string;
  total_loans: number;
  outstanding_balance: number;
}

// --- Reusable Form Component ---
const MemberForm = ({ member, branches, groups, onSubmit, onCancel, isSubmitting, error }) => {
  const [formData, setFormData] = useState({
    full_name: member?.full_name || '',
    id_number: member?.id_number || '',
    phone_number: member?.phone_number || '',
    address: member?.address || '',
    group_id: member?.group_id?.toString() || '',
    branch_id: member?.branch_id?.toString() || '',
    next_of_kin_name: member?.next_of_kin_name || '',
    next_of_kin_phone: member?.next_of_kin_phone || '',
    notes: member?.notes || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 max-h-[70vh] overflow-y-auto px-1">
      {error && <Alert variant="destructive" className="md:col-span-2"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      <InputWithLabel id="full_name" label="Full Name" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} required disabled={isSubmitting} />
      <InputWithLabel id="id_number" label="ID Number" value={formData.id_number} onChange={e => setFormData({...formData, id_number: e.target.value})} required disabled={isSubmitting} />
      <InputWithLabel id="phone_number" label="Phone Number" value={formData.phone_number} onChange={e => setFormData({...formData, phone_number: e.target.value})} required disabled={isSubmitting} />
      <InputWithLabel id="address" label="Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} disabled={isSubmitting} />
      <SelectWithLabel id="branch_id" label="Branch" placeholder="Select a branch" value={formData.branch_id} onValueChange={v => setFormData({...formData, branch_id: v})} options={branches.map(b => ({ value: String(b.id), label: b.name }))} required disabled={isSubmitting} />
      <SelectWithLabel id="group_id" label="Group" placeholder="Select a group" value={formData.group_id} onValueChange={v => setFormData({...formData, group_id: v})} options={groups.map(g => ({ value: String(g.id), label: g.name }))} required disabled={isSubmitting} />
      <InputWithLabel id="next_of_kin_name" label="Next of Kin Name" value={formData.next_of_kin_name} onChange={e => setFormData({...formData, next_of_kin_name: e.target.value})} disabled={isSubmitting} />
      <InputWithLabel id="next_of_kin_phone" label="Next of Kin Phone" value={formData.next_of_kin_phone} onChange={e => setFormData({...formData, next_of_kin_phone: e.target.value})} disabled={isSubmitting} />
      <div className="md:col-span-2">
        <InputWithLabel id="notes" label="Notes" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} disabled={isSubmitting} />
      </div>
      <DialogFooter className="md:col-span-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{member ? 'Update Member' : 'Create Member'}</Button>
      </DialogFooter>
    </form>
  );
};

// --- Member Profile View ---
const MemberProfile = ({ member, onBack }) => {
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);
  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Back to Members List</Button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="text-center">
            <div className="w-24 h-24 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-12 h-12 text-muted-foreground" />
            </div>
            <CardTitle>{member.full_name}</CardTitle>
            <CardDescription>{member.id_number}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-4">
            <InfoItem icon={Phone} label="Phone Number" value={member.phone_number} />
            <InfoItem icon={MapPin} label="Address" value={member.address} />
            <InfoItem icon={Users} label="Group" value={member.group_name} />
            <InfoItem icon={Landmark} label="Branch" value={member.branch_name} />
          </CardContent>
        </Card>
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Financial Summary</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <InfoItem icon={Hash} label="Total Loans Taken" value={member.total_loans} />
              <InfoItem icon={DollarSign} label="Outstanding Balance" value={formatCurrency(member.outstanding_balance)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Emergency Contact</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <InfoItem icon={Users} label="Next of Kin" value={member.next_of_kin_name} />
              <InfoItem icon={Phone} label="Next of Kin Phone" value={member.next_of_kin_phone} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// --- Main Members Page Component ---
const Members = () => {
  const { isSuperAdmin, user } = useAuth();
  const [view, setView] = useState<{ page: 'list' | 'profile', data: Member | null }>({ page: 'list', data: null });
  const [members, setMembers] = useState<Member[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modal, setModal] = useState<{ type: 'create' | 'edit' | 'delete' | null, data: Member | null }>({ type: null, data: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchMembers(), fetchGroups(), fetchBranches()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase.from('members_with_details').select('*');
      if (error) throw error;
      setMembers(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch members', { description: error.message });
    }
  };

  const fetchGroups = async () => {
    try {
        const { data, error } = await supabase.from('groups').select('*');
        if (error) throw error;
        setGroups(data || []);
    } catch (error: any) {
        toast.error('Failed to fetch groups');
    }
  };

  const fetchBranches = async () => {
    try {
        const { data, error } = await supabase.from('branches').select('*');
        if (error) throw error;
        setBranches(data || []);
    } catch (error: any) {
        toast.error('Failed to fetch branches');
    }
  };

  const handleCreateMember = async (formData) => {
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const { error } = await supabase.from('members').insert({ ...formData, created_by: user?.id, status: 'active' });
      if (error) throw error;
      toast.success('Member created successfully');
      setModal({ type: null, data: null });
      await fetchMembers();
    } catch (error: any) {
      // FIX: Provide a user-friendly error for duplicate ID numbers
      if (error.message && error.message.includes('duplicate key value violates unique constraint')) {
        setSubmitError('A member with this ID Number already exists. Please use a unique ID.');
      } else {
        setSubmitError(error.message || 'An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateMember = async (formData) => {
    if (!modal.data) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const { error } = await supabase.from('members').update(formData).eq('id', modal.data.id);
      if (error) throw error;
      toast.success('Member updated successfully');
      setModal({ type: null, data: null });
      await fetchMembers();
    } catch (error: any) {
      // FIX: Provide a user-friendly error for duplicate ID numbers
      if (error.message && error.message.includes('duplicate key value violates unique constraint')) {
        setSubmitError('A member with this ID Number already exists. Please use a unique ID.');
      } else {
        setSubmitError(error.message || 'An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!modal.data) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('members').delete().eq('id', modal.data.id);
      if (error) throw error;
      toast.success('Member deleted successfully');
      setModal({ type: null, data: null });
      await fetchMembers();
    } catch (error: any) {
      toast.error('Failed to delete member', { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredMembers = members.filter(member => {
    const matchesSearch = member.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || member.status === statusFilter;
    const matchesBranch = branchFilter === 'all' || member.branch_name === branchFilter;
    return matchesSearch && matchesStatus && matchesBranch;
  });

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (view.page === 'profile' && view.data) {
    return <div className="p-6"><MemberProfile member={view.data} onBack={() => setView({ page: 'list', data: null })} /></div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Members Management</h1>
          <p className="text-muted-foreground">Manage and monitor all registered members</p>
        </div>
        {isSuperAdmin && <Button onClick={() => setModal({ type: 'create', data: null })}><Plus className="h-4 w-4 mr-2" />Add Member</Button>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Total Members" value={members.length} icon={Users} />
        <StatCard title="Active Members" value={members.filter(m => m.status === 'active').length} icon={Users} />
        <StatCard title="Total Loans" value={members.reduce((sum, m) => sum + (m.total_loans || 0), 0)} icon={Banknote} />
        <StatCard title="Total Outstanding" value={formatCurrency(members.reduce((sum, m) => sum + (m.outstanding_balance || 0), 0))} icon={DollarSign} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row justify-between gap-4">
            <div><CardTitle>Members Directory</CardTitle><CardDescription>Complete registry of all members.</CardDescription></div>
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
              <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" /></div>
              <Select value={branchFilter} onValueChange={setBranchFilter}><SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Branches" /></SelectTrigger><SelectContent><SelectItem value="all">All Branches</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}</SelectContent></Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Financials</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="font-medium">{member.full_name}</div>
                      <div className="text-sm text-muted-foreground">{member.branch_name}</div>
                    </TableCell>
                    <TableCell>
                      <div><span className="font-semibold">Loans:</span> {member.total_loans}</div>
                      <div className="text-sm text-muted-foreground">Outstanding: {formatCurrency(member.outstanding_balance)}</div>
                    </TableCell>
                    <TableCell><Badge variant={member.status === 'active' ? 'default' : 'secondary'} className="capitalize">{member.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setView({ page: 'profile', data: member })}><Eye className="h-4 w-4" /></Button>
                        <Button variant="outline" size="sm" onClick={() => setModal({ type: 'edit', data: member })}><Edit className="h-4 w-4" /></Button>
                        <Button variant="destructive" size="sm" onClick={() => setModal({ type: 'delete', data: member })}><Trash2 className="h-4 w-4" /></Button>
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
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{modal.type === 'edit' ? 'Edit Member' : 'Add New Member'}</DialogTitle></DialogHeader>
          <MemberForm 
            member={modal.data} 
            branches={branches} 
            groups={groups} 
            onSubmit={modal.type === 'edit' ? handleUpdateMember : handleCreateMember} 
            onCancel={() => setModal({ type: null, data: null })}
            isSubmitting={isSubmitting}
            error={submitError}
          />
        </DialogContent>
      </Dialog>
      
      <Dialog open={modal.type === 'delete'} onOpenChange={() => setModal({ type: null, data: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Confirm Deletion</DialogTitle></DialogHeader>
          <p>Are you sure you want to delete the member "{modal.data?.full_name}"? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal({ type: null, data: null })}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteMember} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete</Button>
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
const InfoItem = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    {Icon && <Icon className="h-5 w-5 text-muted-foreground mt-1" />}
    <div className="flex flex-col">
      <Label>{label}</Label>
      <p className="font-medium">{value || 'N/A'}</p>
    </div>
  </div>
);

export default Members;
