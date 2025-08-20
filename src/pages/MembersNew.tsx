import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Users, UserPlus, Edit, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface Member {
  id: string;
  full_name: string;
  id_number: string;
  phone_number: string;
  address?: string;
  group_id?: number;
  branch_id?: number;
  status: string;
  next_of_kin_name?: string;
  next_of_kin_phone?: string;
  next_of_kin_relationship?: string;
  photo_url?: string;
  notes?: string;
  group_name?: string;
  branch_name?: string;
  created_at: string;
}

const MembersNew = () => {
  const { user, isSuperAdmin, isBranchAdmin } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    id_number: '',
    phone_number: '',
    address: '',
    group_id: '',
    branch_id: '',
    status: 'active',
    next_of_kin_name: '',
    next_of_kin_phone: '',
    next_of_kin_relationship: '',
    notes: ''
  });

  useEffect(() => {
    fetchMembers();
    fetchGroups();
    fetchBranches();
  }, []);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select(`
          *,
          groups (name),
          branches (name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedMembers = data?.map(member => ({
        ...member,
        group_name: (member.groups as any)?.name,
        branch_name: (member.branches as any)?.name
      })) || [];

      setMembers(formattedMembers);
    } catch (error) {
      toast.error('Failed to fetch members');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    const { data } = await supabase.from('groups').select('*');
    setGroups(data || []);
  };

  const fetchBranches = async () => {
    const { data } = await supabase.from('branches').select('*');
    setBranches(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const memberData = {
        ...formData,
        group_id: formData.group_id ? parseInt(formData.group_id) : null,
        branch_id: formData.branch_id ? parseInt(formData.branch_id) : null,
        created_by: user?.id
      };

      if (editingMember) {
        const { error } = await supabase
          .from('members')
          .update(memberData)
          .eq('id', editingMember.id);
        
        if (error) throw error;
        toast.success('Member updated successfully');
      } else {
        const { error } = await supabase
          .from('members')
          .insert(memberData);
        
        if (error) throw error;
        toast.success('Member created successfully');
      }

      setIsDialogOpen(false);
      setEditingMember(null);
      resetForm();
      fetchMembers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save member');
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      id_number: '',
      phone_number: '',
      address: '',
      group_id: '',
      branch_id: '',
      status: 'active',
      next_of_kin_name: '',
      next_of_kin_phone: '',
      next_of_kin_relationship: '',
      notes: ''
    });
  };

  const handleEdit = (member: Member) => {
    setEditingMember(member);
    setFormData({
      full_name: member.full_name,
      id_number: member.id_number,
      phone_number: member.phone_number,
      address: member.address || '',
      group_id: member.group_id?.toString() || '',
      branch_id: member.branch_id?.toString() || '',
      status: member.status,
      next_of_kin_name: member.next_of_kin_name || '',
      next_of_kin_phone: member.next_of_kin_phone || '',
      next_of_kin_relationship: member.next_of_kin_relationship || '',
      notes: member.notes || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this member?')) return;
    
    try {
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Member deleted successfully');
      fetchMembers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete member');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">Members Management</h1>
        {(isSuperAdmin || isBranchAdmin) && (
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingMember(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingMember ? 'Edit Member' : 'Add New Member'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="id_number">ID Number</Label>
                    <Input
                      id="id_number"
                      value={formData.id_number}
                      onChange={(e) => setFormData({...formData, id_number: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone_number">Phone Number</Label>
                    <Input
                      id="phone_number"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="group_id">Group</Label>
                    <Select value={formData.group_id} onValueChange={(value) => setFormData({...formData, group_id: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select group" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((group) => (
                          <SelectItem key={group.id} value={group.id.toString()}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="branch_id">Branch</Label>
                    <Select value={formData.branch_id} onValueChange={(value) => setFormData({...formData, branch_id: value})}>
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
                </div>
                
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="next_of_kin_name">Next of Kin Name</Label>
                    <Input
                      id="next_of_kin_name"
                      value={formData.next_of_kin_name}
                      onChange={(e) => setFormData({...formData, next_of_kin_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="next_of_kin_phone">Next of Kin Phone</Label>
                    <Input
                      id="next_of_kin_phone"
                      value={formData.next_of_kin_phone}
                      onChange={(e) => setFormData({...formData, next_of_kin_phone: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="next_of_kin_relationship">Relationship</Label>
                    <Input
                      id="next_of_kin_relationship"
                      value={formData.next_of_kin_relationship}
                      onChange={(e) => setFormData({...formData, next_of_kin_relationship: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  />
                </div>

                <Button type="submit" className="w-full">
                  {editingMember ? 'Update Member' : 'Create Member'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Community Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading members...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>ID Number</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.full_name}</TableCell>
                    <TableCell>{member.id_number}</TableCell>
                    <TableCell>{member.phone_number}</TableCell>
                    <TableCell>{member.group_name || '-'}</TableCell>
                    <TableCell>{member.branch_name || '-'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${
                        member.status === 'active' ? 'bg-green-100 text-green-800' :
                        member.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {member.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(member)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {(isSuperAdmin || isBranchAdmin) && (
                          <Button variant="outline" size="sm" onClick={() => handleDelete(member.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MembersNew;