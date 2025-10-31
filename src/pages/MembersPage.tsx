import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Edit, Trash2, Users, Eye, Banknote, DollarSign, Loader2, UserCheck, CheckCircle, XCircle, AlertCircle, Ban } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table'; // We will use our new reusable component
import { ExportDropdown } from '@/components/ui/ExportDropdown';
import { DateRangeFilter, DateRange, filterDataByDateRange } from '@/components/ui/DateRangeFilter';

// --- Type Definitions ---
// This type matches the output of our secure database function
interface MemberSummary {
  member_id: string; // Changed from 'id' to 'member_id' to match RPC function
  full_name: string;
  id_number: string;
  phone_number: string;
  status: string;
  branch_name: string;
  total_loans: number;
  outstanding_balance: number;
}

const MembersPage: React.FC = () => {
  const { user, userRole, profile } = useAuth();
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [deleteCandidate, setDeleteCandidate] = useState<MemberSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });

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
      // Step 1: Fetch members based on user role
      let membersQuery = supabase.from('members').select('*');
      
      // Apply role-based filtering
      if (userRole === 'loan_officer') {
        // Loan officers can only see members assigned to them
        membersQuery = membersQuery.eq('assigned_officer_id', user?.id);
      } else if (userRole === 'branch_admin' && profile?.branch_id) {
        // Branch admins can see members in their branch
        membersQuery = membersQuery.eq('branch_id', profile.branch_id);
      } else if (userRole !== 'super_admin' && profile?.branch_id) {
        // Teller/Auditor - see only their branch members
        membersQuery = membersQuery.eq('branch_id', profile.branch_id);
      }
      // Super admins and others without branch restrictions see all members
      
      const { data: membersData, error: membersError } = await membersQuery;
      
      if (membersError) throw membersError;
      
      if (!membersData || membersData.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }
      
      // Step 2: Fetch loan data for each member
      const memberIds = membersData.map(member => member.id);
      
      // Fetch loans for all members - exclude deleted loans
      const { data: loansData, error: loansError } = await supabase
        .from('loans')
        .select('*')
        .eq('is_deleted', false);
      
      if (loansError) {
        throw loansError;
      }
      
      // Calculate loan statistics for each member
      const membersWithLoanData = membersData.map(member => {
        // Find loans for this member (check member_id)
        const memberLoans = loansData?.filter(loan => 
          loan.member_id === member.id
        ) || [];
        
        // Calculate total loans and outstanding balance
        const totalLoans = memberLoans.length;
        const outstandingBalance = memberLoans.reduce((sum, loan) => {
          // Count loans that have outstanding balance (active, pending)
          const status = loan.status as string;
          if (status === 'active' || status === 'pending') {
            return sum + (loan.current_balance || 0);
          }
          return sum;
        }, 0);
        
        // Concatenate first_name and last_name to create full_name
        const fullName = member.first_name && member.last_name 
          ? `${member.first_name} ${member.last_name}`.trim()
          : member.first_name || member.last_name || 'Unknown Member';
        
        return {
          member_id: member.id,
          full_name: fullName,
          id_number: member.id_number || member.id.slice(0, 8),
          phone_number: member.phone_number || 'N/A',
          status: member.status || 'active',
          branch_name: 'Nairobi', // Hardcoded for now, can be enhanced later
          total_loans: totalLoans,
          outstanding_balance: outstandingBalance,
        };
      });
      
      setMembers(membersWithLoanData);
      
    } catch (error: any) {
      toast.error('Failed to fetch members', { description: error.message });
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!deleteCandidate) return;
    setIsDeleting(true);
    try {
      // Check if member has active/pending loans (repaid/completed loans will be auto-deleted)
      // Check all loans including soft-deleted ones as foreign key constraints still apply
      const { data: allLoans, error: loansError } = await supabase
        .from('loans')
        .select('id, status, is_deleted')
        .eq('member_id', deleteCandidate.member_id);

      if (loansError) {
        console.error('Error checking loans:', loansError);
      }

      console.log(`Found ${allLoans?.length || 0} total loans for member:`, allLoans);

      // Separate active and repaid/completed loans (including soft-deleted ones)
      // We need to handle ALL loans because foreign key constraints apply regardless of is_deleted flag
      const activeLoans = (allLoans || []).filter(
        loan => (loan.is_deleted === false || loan.is_deleted === null) && 
                loan.status !== 'repaid' && loan.status !== 'completed'
      );
      const repaidLoans = (allLoans || []).filter(
        loan => loan.status === 'repaid' || loan.status === 'completed'
      );
      
      console.log(`Active loans: ${activeLoans.length}, Repaid loans: ${repaidLoans.length} (including soft-deleted)`);

      // Block if there are active loans
      if (activeLoans && activeLoans.length > 0) {
        toast.error('Cannot Delete Member', {
          description: `This member has ${activeLoans.length} active loan(s). Please delete or close all loans before deleting the member.`,
        });
        setIsDeleting(false);
        return;
      }

      // Delete repaid/completed loans first to avoid foreign key constraint
      // This includes soft-deleted loans which still have foreign key constraints
      if (repaidLoans.length > 0) {
        const repaidLoanIds = repaidLoans.map(loan => loan.id);
        console.log(`Attempting to hard delete ${repaidLoanIds.length} repaid loans (including soft-deleted):`, repaidLoanIds);
        
        // First, delete or update related records in realizable_assets
        for (const loanId of repaidLoanIds) {
          // Try to delete realizable_assets that reference this loan
          const { error: deleteAssetsError } = await supabase
            .from('realizable_assets')
            .delete()
            .eq('loan_id', loanId);
          
          if (deleteAssetsError) {
            console.warn(`Could not delete realizable_assets for loan ${loanId}, trying to set loan_id to null:`, deleteAssetsError);
            // If deletion fails (permissions), try setting loan_id to null
            const { error: updateAssetsError } = await supabase
              .from('realizable_assets')
              .update({ loan_id: null })
              .eq('loan_id', loanId);
            
            if (updateAssetsError) {
              console.error(`Could not update realizable_assets for loan ${loanId}:`, updateAssetsError);
              // Continue anyway - might not have any assets
            }
          }
        }
        
        // Hard delete the loans (this will work even if they're already soft-deleted)
        const { data: deletedData, error: deleteLoansError } = await supabase
          .from('loans')
          .delete()
          .in('id', repaidLoanIds)
          .select();

        if (deleteLoansError) {
          console.error('Error deleting repaid loans:', deleteLoansError);
          toast.error('Cannot Delete Member', {
            description: `Unable to delete ${repaidLoans.length} repaid loan(s) due to: ${deleteLoansError.message}. Please ensure you have proper permissions.`,
          });
          setIsDeleting(false);
          return;
        }
        
        console.log('Successfully deleted repaid loans:', deletedData);
        
        // Verify they're actually deleted from the database
        const { data: verifyLoans } = await supabase
          .from('loans')
          .select('id')
          .eq('member_id', deleteCandidate.member_id)
          .in('id', repaidLoanIds);
        
        if (verifyLoans && verifyLoans.length > 0) {
          console.warn('Some loans still exist after deletion attempt:', verifyLoans);
          toast.error('Cannot Delete Member', {
            description: `${verifyLoans.length} repaid loan(s) could not be deleted. Please try again or contact an administrator.`,
          });
          setIsDeleting(false);
          return;
        }
        
        // Wait a brief moment for database to process the deletion
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Final check: Verify NO loans remain for this member
        const { data: remainingLoansCheck } = await supabase
          .from('loans')
          .select('id, status, is_deleted')
          .eq('member_id', deleteCandidate.member_id);
        
        if (remainingLoansCheck && remainingLoansCheck.length > 0) {
          console.error('Still found loans after deletion attempt:', remainingLoansCheck);
          // Log details about remaining loans
          const activeRemaining = remainingLoansCheck.filter(l => !l.is_deleted);
          const softDeletedRemaining = remainingLoansCheck.filter(l => l.is_deleted);
          console.error(`Active remaining: ${activeRemaining.length}, Soft-deleted remaining: ${softDeletedRemaining.length}`);
          
          // Since member_id cannot be NULL, we must delete these loans
          // Try to delete them again one by one with better error reporting
          for (const loan of remainingLoansCheck) {
            console.log(`Attempting to delete loan ${loan.id} (status: ${loan.status}, is_deleted: ${loan.is_deleted})`);
            
            // First ensure realizable_assets are handled
            const { error: assetsError } = await supabase
              .from('realizable_assets')
              .delete()
              .eq('loan_id', loan.id);
            
            if (assetsError) {
              console.warn(`Could not delete realizable_assets for loan ${loan.id}:`, assetsError);
              // Try setting loan_id to null in realizable_assets
              await supabase
                .from('realizable_assets')
                .update({ loan_id: null })
                .eq('loan_id', loan.id);
            }
            
            // Now try to delete the loan
            const { error: loanDeleteError } = await supabase
              .from('loans')
              .delete()
              .eq('id', loan.id);
            
            if (loanDeleteError) {
              console.error(`Failed to delete loan ${loan.id}:`, loanDeleteError);
            }
          }
        }
      }

      // Final verification before member deletion
      const { data: finalLoansCheck } = await supabase
        .from('loans')
        .select('id')
        .eq('member_id', deleteCandidate.member_id);
      
      if (finalLoansCheck && finalLoansCheck.length > 0) {
        toast.error('Cannot Delete Member', {
          description: `Member still has ${finalLoansCheck.length} loan(s) that could not be removed. Please contact an administrator.`,
        });
        setIsDeleting(false);
        return;
      }

      const { error } = await supabase.from('members').delete().eq('id', deleteCandidate.member_id);
      if (error) {
        // Check if error is related to foreign key constraint
        if (error.message && error.message.includes('foreign key constraint')) {
          // Re-check for any remaining loans
          const { data: remainingLoans } = await supabase
            .from('loans')
            .select('id, status')
            .eq('member_id', deleteCandidate.member_id)
            .eq('is_deleted', false);
          
          const activeRemaining = (remainingLoans || []).filter(
            loan => loan.status !== 'repaid' && loan.status !== 'completed'
          );
          
          if (activeRemaining.length > 0) {
            toast.error('Cannot Delete Member', {
              description: `This member has ${activeRemaining.length} active loan(s). Please delete or close all loans before deleting the member.`,
            });
          } else {
            toast.error('Cannot Delete Member', {
              description: 'This member has associated loans that could not be automatically deleted. Please contact an administrator.',
            });
          }
        } else {
          throw error;
        }
        return;
      }
      
      if (repaidLoans.length > 0) {
        toast.success(`Member "${deleteCandidate.full_name}" deleted successfully. (Also deleted ${repaidLoans.length} repaid loan(s))`);
      } else {
        toast.success(`Member "${deleteCandidate.full_name}" deleted successfully.`);
      }
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

  // Apply date filtering to the already filtered members
  const dateFilteredMembers = filteredMembers; // Simplified for now - date filtering can be added later

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);

  const getStatusBadge = (member: MemberSummary) => {
    if (member.status === 'active') {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Active
        </Badge>
      );
    } else if (member.status === 'inactive') {
      return (
        <Badge className="bg-red-100 text-red-800">
          <XCircle className="w-3 h-3 mr-1" />
          Inactive
        </Badge>
      );
    } else if (member.status === 'dormant') {
      return (
        <Badge className="bg-yellow-100 text-yellow-800">
          <AlertCircle className="w-3 h-3 mr-1" />
          Dormant
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-gray-100 text-gray-800">
          <AlertCircle className="w-3 h-3 mr-1" />
          {member.status}
        </Badge>
      );
    }
  };

  // --- DataTable Column Definitions ---
  const columns = [
    {
        header: 'Member',
        cell: (row: MemberSummary) => (
            <div>
                <div className="font-medium">{row.full_name}</div>
                <div className="text-sm text-muted-foreground">{row.branch_name}</div>
                <div className="mt-1">{getStatusBadge(row)}</div>
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
                <Button asChild variant="outline" size="icon"><Link to={`/members/${row.member_id}`}><Eye className="h-4 w-4" /></Link></Button>
                {(userRole === 'super_admin' || userRole === 'admin') && (
                    <>
                        <Button asChild variant="outline" size="icon"><Link to={`/members/${row.member_id}/edit`}><Edit className="h-4 w-4" /></Link></Button>
                        <Button variant="destructive" size="icon" onClick={() => setDeleteCandidate(row)}><Trash2 className="h-4 w-4" /></Button>
                    </>
                )}
            </div>
        )
    }
  ];

  // Export columns configuration
  const exportColumns = [
    { header: 'Member Name', accessorKey: 'full_name' as keyof MemberSummary },
    { header: 'ID Number', accessorKey: 'id_number' as keyof MemberSummary },
    { header: 'Phone Number', accessorKey: 'phone_number' as keyof MemberSummary },
    { header: 'Status', accessorKey: 'status' as keyof MemberSummary },
    { header: 'Branch', accessorKey: 'branch_name' as keyof MemberSummary },
    { header: 'Total Loans', accessorKey: 'total_loans' as keyof MemberSummary },
    { header: 'Outstanding Balance', accessorKey: (row: MemberSummary) => formatCurrency(row.outstanding_balance) },
  ];

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4 md:space-y-6 p-3 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {userRole === 'loan_officer' ? 'My Assigned Members' : 'Members'}
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            {userRole === 'loan_officer' 
              ? 'View members assigned to you. You can add new members but cannot edit or delete existing ones.'
              : userRole === 'super_admin'
              ? 'Full access to manage, edit, and delete all members.'
              : 'View and add new members. Only super admins can edit or delete existing members.'
            }
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <ExportDropdown 
            data={dateFilteredMembers} 
            columns={exportColumns} 
            fileName="members-report" 
            reportTitle="Members Report"
            dateRange={dateRange}
          />
          <Button asChild className="w-full sm:w-auto">
            <Link to="/members/new">
              <Plus className="h-4 w-4 mr-2" />
              New Member
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Members" value={members.length} icon={Users} />
        <StatCard title="Active Members" value={members.filter(m => m.status === 'active').length} icon={UserCheck} />
        <StatCard title="Dormant Members" value={members.filter(m => m.status === 'dormant').length} icon={AlertCircle} />
        <StatCard title="Inactive Members" value={members.filter(m => m.status === 'inactive').length} icon={XCircle} />
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-lg">Member Records</CardTitle>
                <CardDescription className="text-sm">
                  {userRole === 'loan_officer' 
                    ? `Showing ${dateFilteredMembers.length} of ${filteredMembers.length} assigned members`
                    : `Showing ${dateFilteredMembers.length} of ${filteredMembers.length} members`
                  }
                  {dateRange.from && dateRange.to && (
                    <span className="text-brand-blue-600 font-medium">
                      {' '}• Filtered by date range
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
            
            {/* Filters Row - Better positioned and spaced */}
            <div className="flex flex-col lg:flex-row gap-3 md:gap-4 w-full">
              {/* Date Filter - Takes priority */}
              <div className="flex-shrink-0">
                <DateRangeFilter
                  onDateRangeChange={setDateRange}
                  placeholder="Filter by date"
                  className="w-full lg:w-auto"
                />
              </div>
              
              {/* Search Filter */}
              <div className="flex-1 min-w-0">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by name, ID, or phone..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="pl-9 w-full" 
                  />
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={dateFilteredMembers} emptyStateMessage="No members found matching your criteria." />
        </CardContent>
      </Card>
      
      <Dialog open={!!deleteCandidate} onOpenChange={() => setDeleteCandidate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Confirm Deletion</DialogTitle></DialogHeader>
          <p>Are you sure you want to permanently delete "<strong>{deleteCandidate?.full_name}</strong>"? This action cannot be undone.</p>
          {deleteCandidate && deleteCandidate.total_loans > 0 && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-md mt-2">
              <div className="flex items-start gap-2">
                <Ban className="h-4 w-4 text-red-500 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-medium">Cannot Delete Member:</p>
                  <p>This member has {deleteCandidate.total_loans} active loan(s). You must delete or close all loans before deleting this member.</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCandidate(null)} disabled={isDeleting}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteMember} 
              disabled={isDeleting || (deleteCandidate?.total_loans || 0) > 0}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

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

export default MembersPage;