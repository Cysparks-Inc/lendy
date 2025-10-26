import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Mail, Phone, MapPin, Banknote, Users, TrendingUp, DollarSign, Eye, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table'; // Reusable component
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';

// --- Type Definitions ---
interface OfficerProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  branch_name: string;
  profile_picture_url: string | null;
  total_loans: number;
  total_disbursed: number;
  total_balance: number;
}

interface OfficerLoan {
  id: string; // Loan ID
  customer_id: string; // Member ID
  account_number: string;
  member_name: string;
  principal_amount: number;
  current_balance: number;
  status: 'active' | 'repaid' | 'defaulted' | 'pending';
  due_date: string;
}

interface OfficerMember {
    id: string;
    full_name: string;
    phone_number: string;
    total_loans: number;
    outstanding_balance: number;
    created_by?: string | null;
}


const LoanOfficerProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, userRole } = useAuth();
  const isAdmin = ['super_admin', 'branch_admin'].includes(userRole || '');
  const isSelf = user?.id === id;
  const [officer, setOfficer] = useState<OfficerProfile | null>(null);
  const [loans, setLoans] = useState<OfficerLoan[]>([]);
  const [members, setMembers] = useState<OfficerMember[]>([]);
  const [unassignedMembers, setUnassignedMembers] = useState<OfficerMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [transferMemberDialogOpen, setTransferMemberDialogOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMemberName, setSelectedMemberName] = useState<string | null>(null);
  const [availableOfficers, setAvailableOfficers] = useState<Array<{id: string, name: string}>>([]);
  const [selectedNewOfficerId, setSelectedNewOfficerId] = useState<string>('');
  const [transferLoading, setTransferLoading] = useState(false);

  useEffect(() => {
    const fetchOfficerData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        
        // Step 1: Fetch officer profile data
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone_number, branch_id')
          .eq('id', id)
          .single();

        if (profileError) throw profileError;
        
        // Step 2: Fetch officer's loans with member names
        const { data: loansData, error: loansError } = await supabase
          .from('loans')
          .select('id, principal_amount, current_balance, status, due_date, member_id, customer_id, loan_officer_id')
          .eq('loan_officer_id', id);

        if (loansError) throw loansError;
        
        // Step 3: Fetch member names for the loans
        const memberIds = [...new Set(loansData.map(loan => loan.member_id || loan.customer_id).filter(Boolean))];
        const { data: membersData, error: membersError } = await supabase
          .from('members')
          .select('id, full_name')
          .in('id', memberIds);

        if (membersError) {
          // Fail gracefully – member names will show as Unknown
        }
        
        // Step 4: Create lookup map for member names
        const membersMap = new Map((membersData || []).map(m => [m.id, m.full_name]));
        
        // Step 5: Transform loans data with member names
        const transformedLoans = loansData.map(loan => {
          const memberId = loan.member_id || loan.customer_id;
          const memberName = memberId ? (membersMap.get(memberId) || `Unknown Member (${memberId.slice(0, 8)})`) : 'Unassigned Member';
          
          return {
            id: loan.id,
            customer_id: memberId,
            account_number: `LN-${loan.id.slice(0, 8).toUpperCase()}`,
            member_name: memberName,
            principal_amount: loan.principal_amount || 0,
            current_balance: loan.current_balance || 0,
            status: loan.status || 'pending',
            due_date: loan.due_date || new Date().toISOString().split('T')[0]
          };
        });
        
        
        
        // Step 6: Fetch members directly assigned to this officer
        const { data: assignedMembersData, error: assignedMembersError } = await supabase
          .from('members')
          .select(`
            id, 
            full_name, 
            phone_number, 
            status,
            assigned_officer_id
          `)
          .eq('assigned_officer_id', id);

        if (assignedMembersError) {
          // ignore – will render empty list
        }
        
        // Step 7: Calculate member portfolio stats
        const transformedMembers = (assignedMembersData || []).map(member => {
          // Get loans for this member
          const memberLoans = loansData.filter(loan => 
            (loan.member_id === member.id || loan.customer_id === member.id)
          );
          
          const totalLoans = memberLoans.length;
          const outstandingBalance = memberLoans
            .filter(loan => ['active', 'pending'].includes(loan.status))
            .reduce((sum, loan) => sum + parseFloat(loan.current_balance || 0), 0);
          
          return {
            id: member.id,
            full_name: member.full_name || 'Unknown Member',
            phone_number: member.phone_number || 'N/A',
            total_loans: totalLoans,
            outstanding_balance: outstandingBalance
          };
        });
        
        
        
        // Step 8: Calculate officer performance metrics
        const totalLoans = transformedLoans.length;
        const totalDisbursed = transformedLoans
          .filter(loan => ['active', 'pending'].includes(loan.status))
          .reduce((sum, loan) => sum + loan.principal_amount, 0);
        const totalBalance = transformedLoans
          .filter(loan => ['active', 'pending'].includes(loan.status))
          .reduce((sum, loan) => sum + loan.current_balance, 0);
        
        // Step 9: Create officer profile object
        const officerProfile: OfficerProfile = {
          id: profileData.id,
          name: profileData.full_name || 'Unknown Officer',
          email: profileData.email || 'N/A',
          phone: profileData.phone_number,
          branch_name: 'Nakuru', // Hardcoded for now, can be enhanced later
          profile_picture_url: null,
          total_loans: totalLoans,
          total_disbursed: totalDisbursed,
          total_balance: totalBalance
        };
        
        // Step 10: Set state
        setOfficer(officerProfile);
        setLoans(transformedLoans);
        setMembers(transformedMembers);
        
        // Step 11: Fetch unassigned members (only those created by this officer)
        const { data: unassignedData, error: unassignedError } = await supabase
          .from('members')
          .select(`
            id, 
            full_name, 
            phone_number, 
            status,
            created_by
          `)
          .is('assigned_officer_id', null)
          .eq('created_by', id);

        if (unassignedError) {
          // ignore – will render empty list
        }
        
        // Calculate portfolio stats for unassigned members
        const transformedUnassigned = (unassignedData || []).map(member => {
          const memberLoans = loansData.filter(loan => 
            (loan.member_id === member.id || loan.customer_id === member.id)
          );
          
          const totalLoans = memberLoans.length;
          const outstandingBalance = memberLoans
            .filter(loan => ['active', 'pending'].includes(loan.status))
            .reduce((sum, loan) => sum + parseFloat(loan.current_balance || 0), 0);
          
          return {
            id: member.id,
            full_name: member.full_name || 'Unknown Member',
            phone_number: member.phone_number || 'N/A',
            total_loans: totalLoans,
            outstanding_balance: outstandingBalance,
            created_by: (member as any).created_by || null
          };
        });
        
        setUnassignedMembers(transformedUnassigned);
        
      } catch (error: any) {
        // Avoid console noise in production
        toast.error('Failed to load officer data', { description: error.message });
      } finally {
        setLoading(false);
      }
    };

    fetchOfficerData();
  }, [id]);

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);
  const getStatusVariant = (status: OfficerLoan['status']) => {
    switch (status) { case 'active': return 'default'; case 'repaid': return 'success'; case 'defaulted': return 'destructive'; case 'pending': return 'warning'; default: return 'secondary'; }
  };

  const loanColumns = [
    { header: 'Account No.', cell: (row: OfficerLoan) => <Link to={`/loans/${row.id}`} className="font-mono text-xs text-primary hover:underline">{row.account_number}</Link> },
    { header: 'Member', cell: (row: OfficerLoan) => <Link to={`/members/${row.customer_id}`} className="hover:underline">{row.member_name}</Link> },
    { header: 'Principal', cell: (row: OfficerLoan) => formatCurrency(row.principal_amount) },
    { header: 'Outstanding', cell: (row: OfficerLoan) => formatCurrency(row.current_balance) },
    { header: 'Status', cell: (row: OfficerLoan) => <Badge variant={getStatusVariant(row.status)} className="capitalize">{row.status}</Badge> },
    { header: 'Actions', cell: (row: OfficerLoan) => <div className="text-right"><Button asChild variant="outline" size="icon"><Link to={`/loans/${row.id}`}><Eye className="h-4 w-4" /></Link></Button></div> },
  ];

  const memberColumns = [
    { header: 'Name', cell: (row: OfficerMember) => <Link to={`/members/${row.id}`} className="font-medium hover:underline">{row.full_name}</Link> },
    { header: 'Phone', cell: (row: OfficerMember) => row.phone_number },
    { header: 'Total Loans', cell: (row: OfficerMember) => row.total_loans },
    { header: 'Outstanding', cell: (row: OfficerMember) => formatCurrency(row.outstanding_balance) },
    { 
      header: 'Actions', 
      cell: (row: OfficerMember) => (
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/members/${row.id}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleTransferMember(row.id, row.full_name)}
            className="text-blue-600 hover:text-blue-700"
          >
            <Users className="h-4 w-4" />
          </Button>
        </div>
      )
    },
  ];

  const unassignedMemberColumns = [
    { header: 'Name', cell: (row: OfficerMember) => <Link to={`/members/${row.id}`} className="font-medium hover:underline">{row.full_name}</Link> },
    { header: 'Phone', cell: (row: OfficerMember) => row.phone_number },
    { header: 'Total Loans', cell: (row: OfficerMember) => row.total_loans },
    { header: 'Outstanding', cell: (row: OfficerMember) => formatCurrency(row.outstanding_balance) },
    { 
      header: 'Actions', 
      cell: (row: OfficerMember) => (
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/members/${row.id}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
          {(isAdmin || (isSelf && row.created_by === id)) && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleAssignSpecificMember(row.id, row.full_name)}
              className="text-brand-blue-600 hover:text-brand-blue-700"
            >
              <Users className="h-4 w-4" />
              Assign to Me
            </Button>
          )}
        </div>
      )
    },
  ];
  
  if (loading) { return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>; }
  if (!officer) { return <div className="text-center p-10"><h2 className="text-xl font-semibold">Loan Officer Not Found</h2></div>; }

  const getInitials = (name: string) => {
    const names = name.split(' ');
    if (names.length === 1) return names[0].charAt(0);
    return names[0].charAt(0) + names[names.length - 1].charAt(0);
  };

  const handleTransferMember = async (memberId: string, memberName: string) => {
    setSelectedMemberId(memberId);
    setSelectedMemberName(memberName);
    setSelectedNewOfficerId('');
    
    // Fetch available loan officers (excluding current one)
    try {
      const { data: officersData, error: officersError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'loan_officer')
        .neq('id', id);

      if (officersError) throw officersError;
      
      const officers = (officersData || []).map(officer => ({
        id: officer.id,
        name: officer.full_name || 'Unknown Officer'
      }));
      
      setAvailableOfficers(officers);
    } catch (error: any) {
      console.error('Error fetching available officers:', error);
      toast.error('Failed to fetch available officers');
    }
    
    setTransferMemberDialogOpen(true);
  };

  const handleTransferConfirm = async () => {
    if (!selectedMemberId || !selectedNewOfficerId) {
      toast.error('Please select a new officer for the member');
      return;
    }

    setTransferLoading(true);
    try {
      // Use the transfer function we created in the migration
      const { error } = await supabase.rpc('transfer_member_to_new_officer', {
        member_id_param: selectedMemberId,
        new_officer_id_param: selectedNewOfficerId
      });

      if (error) throw error;

      toast.success(`Member ${selectedMemberName} transferred successfully!`);
      setTransferMemberDialogOpen(false);
      setSelectedMemberId(null);
      setSelectedMemberName(null);
      setSelectedNewOfficerId('');

      // Re-fetch data to update the display
      window.location.reload();

    } catch (error: any) {
      console.error('Error transferring member:', error);
      toast.error('Failed to transfer member', { description: error.message });
    } finally {
      setTransferLoading(false);
    }
  };

  const handleTransferCancel = () => {
    setTransferMemberDialogOpen(false);
    setSelectedMemberId(null);
    setSelectedMemberName(null);
  };

  const handleAssignUnassignedMembers = async () => {
    if (!id) return;
    setTransferLoading(true);
    try {
      const { error } = await supabase.rpc('assign_unassigned_members_to_officer', {
        officer_id_param: id
      });

      if (error) throw error;

      toast.success('Unassigned members assigned to this officer successfully!');
      // Re-fetch data to update the display
      window.location.reload();
    } catch (error: any) {
      console.error('Error assigning unassigned members:', error);
      toast.error('Failed to assign unassigned members', { description: error.message });
    } finally {
      setTransferLoading(false);
    }
  };

  const handleAssignSpecificMember = async (memberId: string, memberName: string) => {
    if (!id || !memberId) return;
    setTransferLoading(true);
    try {
      // Assign the member to the current officer
      const { error } = await supabase
        .from('members')
        .update({ assigned_officer_id: id })
        .eq('id', memberId);

      if (error) throw error;

      toast.success(`Member ${memberName} assigned to ${officer?.name} successfully!`);
      setTransferMemberDialogOpen(false);
      setSelectedMemberId(null);
      setSelectedMemberName(null);
      setSelectedNewOfficerId('');

      // Re-fetch data to update the display
      window.location.reload();

    } catch (error: any) {
      console.error('Error assigning member:', error);
      toast.error('Failed to assign member', { description: error.message });
    } finally {
      setTransferLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-2 sm:p-4 md:p-6">
      {/* Modern Mobile-First Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
              <Link to="/loan-officer">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Officer List
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{officer.name}</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Performance and portfolio overview</p>
            </div>
          </div>
          
        </div>
      </div>
      
      {/* Modern Profile Card with Better Mobile Layout */}
      {/* Profile Card */}
      <Card className="overflow-hidden bg-gradient-to-br from-brand-blue-50 to-brand-blue-100 border-brand-blue-200 hover:border-brand-blue-300 transition-all duration-200 hover:shadow-md">
        <CardHeader className="pb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="relative">
              <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-2 border-brand-blue-200">
                <AvatarImage src={officer.profile_picture_url} alt={officer.name} />
                <AvatarFallback className="bg-brand-blue-100 text-brand-blue-700 text-lg">
                  {getInitials(officer.name)}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="text-center sm:text-left">
              <CardTitle className="text-2xl sm:text-3xl text-brand-blue-800 mb-2">{officer.name}</CardTitle>
              <CardDescription className="text-brand-blue-600">{officer.email}</CardDescription>
              <div className="flex flex-wrap gap-4 mt-4 text-sm">
                <div className="text-brand-blue-700">
                  <span className="font-semibold">{members.length}</span> Assigned Members
                </div>
                <div className="text-brand-blue-700">
                  <span className="font-semibold">{unassignedMembers.length}</span> Unassigned Members
                </div>
                <div className="text-brand-blue-700">
                  <span className="font-semibold">{loans.length}</span> Total Loans
                </div>
                <div className="text-brand-blue-700">
                  <span className="font-semibold">{formatCurrency(officer.total_disbursed)}</span> Portfolio
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      {/* Tabs Section */}
      <Tabs defaultValue="loans" className="w-full">
        <TabsList className="w-full flex gap-2 overflow-x-auto whitespace-nowrap no-scrollbar">
          <TabsTrigger value="loans" className="text-xs sm:text-sm px-3 py-2 flex-shrink-0">Loan Portfolio ({loans.length})</TabsTrigger>
          <TabsTrigger value="members" className="text-xs sm:text-sm px-3 py-2 flex-shrink-0">Member Portfolio ({members.length})</TabsTrigger>
          <TabsTrigger value="unassigned" className="text-xs sm:text-sm px-3 py-2 flex-shrink-0">Unassigned Members ({unassignedMembers.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="loans" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Loan Portfolio</CardTitle>
              <CardDescription>All loans managed by {officer.name}.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable columns={loanColumns} data={loans} emptyStateMessage="This officer has not managed any loans yet." />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="members" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Member Portfolio</CardTitle>
                  <CardDescription>All members assigned to {officer.name}.</CardDescription>
                </div>
                {isAdmin && (
                  <Button 
                    variant="outline" 
                    onClick={handleAssignUnassignedMembers}
                    className="text-brand-blue-600 hover:text-brand-blue-700"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Assign Unassigned Members
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <DataTable columns={memberColumns} data={members} emptyStateMessage="This officer is not assigned to any members." />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="unassigned" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Unassigned Members</CardTitle>
                  <CardDescription>Members not currently assigned to any loan officer.</CardDescription>
                </div>
                {isAdmin && (
                  <Button 
                    variant="outline" 
                    onClick={handleAssignUnassignedMembers}
                    className="text-brand-blue-600 hover:text-brand-blue-700"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Assign All to Me
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <DataTable 
                columns={unassignedMemberColumns} 
                data={unassignedMembers} 
                emptyStateMessage="All members are already assigned to loan officers." 
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={transferMemberDialogOpen} onOpenChange={setTransferMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedMemberId && members.find(m => m.id === selectedMemberId) 
                ? 'Transfer Member' 
                : 'Assign Member'
              }
            </DialogTitle>
            <DialogDescription>
              {selectedMemberId && members.find(m => m.id === selectedMemberId)
                ? `Transfer member ${selectedMemberName} to a different loan officer.`
                : `Assign member ${selectedMemberName} to ${officer?.name}.`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="member-id" className="text-right">
                Member ID
              </Label>
              <Input id="member-id" value={selectedMemberId || ''} readOnly />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="member-name" className="text-right">
                Member Name
              </Label>
              <Input id="member-name" value={selectedMemberName || ''} readOnly />
            </div>
            {selectedMemberId && members.find(m => m.id === selectedMemberId) ? (
              // Show officer selection for transfer
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="new-officer" className="text-right">
                  New Officer
                </Label>
                <Select value={selectedNewOfficerId} onValueChange={setSelectedNewOfficerId}>
                  <SelectTrigger id="new-officer">
                    <SelectValue placeholder="Select a new officer" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOfficers.map(officer => (
                      <SelectItem key={officer.id} value={officer.id}>
                        {officer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              // Show current officer info for assignment
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="current-officer" className="text-right">
                  Assign To
                </Label>
                <Input id="current-officer" value={officer?.name || ''} readOnly />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleTransferCancel}>Cancel</Button>
            {selectedMemberId && members.find(m => m.id === selectedMemberId) ? (
              // Transfer button
              <Button 
                onClick={handleTransferConfirm} 
                disabled={!selectedNewOfficerId || transferLoading}
              >
                {transferLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Transferring...
                  </>
                ) : (
                  'Transfer Member'
                )}
              </Button>
            ) : (
              // Assign button
              <Button 
                onClick={handleAssignSpecificMember} 
                disabled={transferLoading}
              >
                {transferLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  'Assign Member'
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const InfoItem: React.FC<{icon: React.ElementType, label: string, value: string | number | null | undefined}> = ({icon: Icon, label, value}) => (
    <div className="space-y-1">
        <p className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Icon className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="truncate">{label}</span>
        </p>
        <p className="font-semibold text-sm sm:text-lg text-foreground truncate">
            {value || 'N/A'}
        </p>
    </div>
);

export default LoanOfficerProfilePage;