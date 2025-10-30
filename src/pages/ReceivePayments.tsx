import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Search, Calendar, CheckCircle, XCircle, AlertCircle, DollarSign } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Loan {
  id: string;
  member_id: string;
  member_name: string;
  member_phone: string;
  principal_amount: number;
  current_balance: number;
  interest_rate: number;
  status: string;
  issue_date: string;
  due_date: string;
  group_id?: number;
  group_name?: string;
  branch_name?: string;
  loan_officer_id?: string;
  installment_amount: number;
  next_payment_date: string;
  overdue_amount: number;
  is_overdue: boolean;
  member_branch_id?: any;
  member_assigned_officer_id?: string;
}

interface PaymentData {
  loan_id: string;
  amount: number;
  notes?: string;
}

interface BulkPaymentData {
  loan_ids: string[];
  total_amount: number;
  notes?: string;
}

const ReceivePayments: React.FC = () => {
  const { user, userRole, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedLoans, setSelectedLoans] = useState<string[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [filteredLoans, setFilteredLoans] = useState<Loan[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  
  // Filters
  const [filters, setFilters] = useState({
    group: 'all',
    branch: 'all',
    loanOfficer: 'all',
    status: 'all',
    searchTerm: ''
  });
  
  // Individual payment form
  const [individualPayment, setIndividualPayment] = useState<PaymentData>({
    loan_id: '',
    amount: 0,
    notes: ''
  });

  // Bulk payment form
  const [bulkPayment, setBulkPayment] = useState<BulkPaymentData>({
    loan_ids: [],
    total_amount: 0,
    notes: ''
  });

  // Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [loanOfficers, setLoanOfficers] = useState<{ id: string; full_name: string }[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterLoans();
  }, [loans, filters]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Build loan query based on role
      let loansQuery = supabase.from('loans').select('*');
      
      // Apply role-based filtering at query level
      if (userRole === 'loan_officer') {
        // Loan officers can only see loans assigned to them or created by them
        loansQuery = loansQuery.or(`loan_officer_id.eq.${user?.id},created_by.eq.${user?.id}`);
      } else if (userRole === 'branch_admin' && profile?.branch_id) {
        // Branch admins see loans from their branch (need to filter after fetching members)
      } else if (userRole !== 'super_admin' && profile?.branch_id) {
        // Teller/Auditor - see only their branch loans
      }
      
      const { data: loansData, error: loansError } = await loansQuery.limit(50);

      if (loansError) throw loansError;

      // Fetch members data using member_id
      const memberIds = loansData?.map(loan => loan.member_id).filter(Boolean) || [];
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('id, first_name, last_name, phone_number, group_id, branch_id, assigned_officer_id')
        .in('id', memberIds);

      if (membersError) throw membersError;

      // Fetch groups data
      const groupIds = membersData?.map(member => member.group_id).filter(Boolean) || [];
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('*')
        .in('id', groupIds);

      if (groupsError) throw groupsError;

      // Fetch branches data
      const branchIds = membersData?.map(member => member.branch_id).filter(Boolean) || [];
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('*')
        .in('id', branchIds);

      if (branchesError) throw branchesError;

      // Fetch loan officers
      const { data: officersData, error: officersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'loan_officer');

      if (officersError) throw officersError;

      // Get unified overdue data
      const { data: overdueData, error: overdueError } = await supabase
        .rpc('get_unified_overdue_loans_report', { requesting_user_id: user?.id });

      if (overdueError) {
        console.warn('Could not fetch overdue data:', overdueError);
      }

      // Format loans data
      let formattedLoans = loansData?.map(loan => {
        const memberId = loan.member_id;
        const member = membersData?.find(m => m.id === memberId);
        const group = groupsData?.find(g => g.id === member?.group_id);
        const branch = branchesData?.find(b => b.id === member?.branch_id);

        // Concatenate first_name and last_name for member name
        const memberName = member?.first_name && member?.last_name
          ? `${member.first_name} ${member.last_name}`.trim()
          : member?.first_name || member?.last_name || 'Unknown Member';

        // Get overdue information from unified function
        const overdueInfo = overdueData?.find(overdue => overdue.id === loan.id);
        const isOverdue = !!overdueInfo;
        const overdueAmount = overdueInfo?.overdue_amount || 0;
        
        // Calculate installment amount (use from overdue info if available, otherwise calculate)
        const installmentAmount = overdueInfo?.installment_amount || (loan.principal_amount || 0) * 0.1;
        
        // Calculate next payment date
        const nextPaymentDate = overdueInfo?.next_due_date ? 
          new Date(overdueInfo.next_due_date) : 
          new Date(loan.issue_date || loan.disbursed_at || loan.created_at || new Date());
        
        // Calculate total loan amount for validation
        const totalLoanAmount = (loan.principal_amount || 0) + (loan.interest_disbursed || 0) + (loan.processing_fee || 0);
        const validatedBalance = Math.max(0, Math.min(loan.current_balance || 0, totalLoanAmount));
        const correctStatus = validatedBalance <= 0 ? 'repaid' : (loan.status || 'active');

        return {
          id: loan.id,
          member_id: memberId,
          member_name: memberName,
          member_phone: member?.phone_number || '',
          principal_amount: loan.principal_amount || 0,
          current_balance: validatedBalance,
          interest_rate: loan.interest_rate || 0,
          status: correctStatus,
          issue_date: loan.issue_date || loan.disbursed_at || loan.created_at || '',
          due_date: loan.due_date || loan.maturity_date || '',
          group_id: member?.group_id,
          group_name: group?.name || 'No Group',
          branch_name: branch?.name || 'Unknown',
          loan_officer_id: loan.loan_officer_id || member?.assigned_officer_id || null,
          installment_amount: installmentAmount,
          next_payment_date: nextPaymentDate.toISOString().split('T')[0],
          overdue_amount: overdueAmount,
          is_overdue: isOverdue,
          member_branch_id: member?.branch_id,
          member_assigned_officer_id: member?.assigned_officer_id
        };
      }) || [];

      // Apply additional role-based filtering for branch admins and other roles
      if (userRole === 'branch_admin' && profile?.branch_id) {
        formattedLoans = formattedLoans.filter(loan => loan.member_branch_id === profile.branch_id);
      } else if (userRole !== 'super_admin' && profile?.branch_id) {
        // Teller/Auditor
        formattedLoans = formattedLoans.filter(loan => loan.member_branch_id === profile.branch_id);
      }

      setLoans(formattedLoans);
      setMembers(membersData || []);
      setGroups(groupsData || []);
      setLoanOfficers(officersData || []);

    } catch (error: any) {
      toast.error('Failed to fetch data', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const filterLoans = () => {
    let filtered = loans;

    // Apply search filter
    if (filters.searchTerm) {
      filtered = filtered.filter(loan =>
        loan.id.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        loan.member_name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        loan.member_phone.includes(filters.searchTerm) ||
        loan.group_name.toLowerCase().includes(filters.searchTerm.toLowerCase())
      );
    }

    // Apply group filter
    if (filters.group !== 'all') {
      filtered = filtered.filter(loan => loan.group_id?.toString() === filters.group);
    }

    // Apply loan officer filter
    if (filters.loanOfficer !== 'all') {
      filtered = filtered.filter(loan => {
        // Prefer direct loan_officer_id, fallback to member.assigned_officer_id
        if ((loan as any).loan_officer_id) {
          return (loan as any).loan_officer_id === filters.loanOfficer;
        }
        const member = members.find(m => m.id === loan.member_id);
        return member?.assigned_officer_id === filters.loanOfficer;
      });
    }

    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(loan => loan.status === filters.status);
    }

    setFilteredLoans(filtered);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleLoanSelect = (loanId: string, checked: boolean) => {
    if (checked) {
      setSelectedLoans([...selectedLoans, loanId]);
    } else {
      setSelectedLoans(selectedLoans.filter(id => id !== loanId));
    }
  };

  const handleIndividualPayment = async () => {
    if (!individualPayment.loan_id || individualPayment.amount <= 0) {
      toast.error('Please select a loan and enter a valid amount');
      return;
    }

    try {
      setSubmitting(true);

      // Insert payment record using loan_payments table (same as loans page)
      const paymentReference = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const { error: paymentError } = await supabase
        .from('loan_payments')
        .insert({
          loan_id: individualPayment.loan_id,
          installment_number: 0, // 0 indicates manual payment not tied to specific installment
          amount: individualPayment.amount,
          payment_date: new Date().toISOString().split('T')[0],
          payment_reference: paymentReference,
          notes: individualPayment.notes,
          created_by: user?.id
        });

      if (paymentError) throw paymentError;

      // Note: Loan balance and status are automatically updated by database triggers

      toast.success('Payment recorded successfully!');
      
      // Close modal and reset form
      setIsPaymentModalOpen(false);
      setIndividualPayment({
        loan_id: '',
        amount: 0,
        notes: ''
      });

      // Refresh data
      fetchData();

    } catch (error: any) {
      toast.error('Failed to record payment', { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkPayment = async () => {
    if (selectedLoans.length === 0) {
      toast.error('Please select at least one loan');
      return;
    }

    try {
      setSubmitting(true);

      // Create payments for each selected loan using loan_payments table
      const payments = selectedLoans.map(loanId => {
        const loan = loans.find(l => l.id === loanId);
        const paymentReference = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${loanId.slice(-4)}`;
        return {
          loan_id: loanId,
          installment_number: 0, // 0 indicates manual payment not tied to specific installment
          amount: loan?.installment_amount || 0,
          payment_date: new Date().toISOString().split('T')[0],
          payment_reference: paymentReference,
          notes: bulkPayment.notes,
          created_by: user?.id
        };
      });

      const { error: paymentsError } = await supabase
        .from('loan_payments')
        .insert(payments);

      if (paymentsError) throw paymentsError;

      // Note: Loan balances and statuses are automatically updated by database triggers

      toast.success(`Bulk payment recorded for ${selectedLoans.length} loans!`);
      
      // Reset form
      setBulkPayment({
        loan_ids: [],
        total_amount: 0,
        notes: ''
      });
      setSelectedLoans([]);

      // Refresh data
      fetchData();

    } catch (error: any) {
      toast.error('Failed to record bulk payment', { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
      repaid: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      defaulted: { color: 'bg-red-100 text-red-800', icon: XCircle },
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getOverdueBadge = (isOverdue: boolean, overdueAmount: number, status: string) => {
    // Don't show overdue for repaid/completed loans
    if (!isOverdue || status === 'repaid' || status === 'completed') return null;
    
    return (
      <Badge className="bg-red-100 text-red-800">
        <AlertCircle className="w-3 h-3 mr-1" />
        Overdue: KES {overdueAmount.toLocaleString()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Receive Payments</h1>
          <p className="text-muted-foreground">
            Filter and view loan payments
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Principal</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {filteredLoans.reduce((sum, loan) => sum + loan.principal_amount, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredLoans.length} loans
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {filteredLoans.reduce((sum, loan) => sum + loan.current_balance, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Outstanding amount
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Installments</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {filteredLoans.reduce((sum, loan) => sum + loan.installment_amount, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Weekly installments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Overdues</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {filteredLoans.reduce((sum, loan) => sum + loan.overdue_amount, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredLoans.filter(loan => loan.is_overdue).length} overdue loans
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Use filters to narrow down the loan data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name, phone, or group..."
                  value={filters.searchTerm}
                  onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="group">Group</Label>
              <Select
                value={filters.group}
                onValueChange={(value) => handleFilterChange('group', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  {Array.from(new Set(loans.map(loan => loan.group_id).filter(Boolean))).map((groupId) => (
                    <SelectItem key={groupId} value={groupId.toString()}>
                      Group {groupId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="loanOfficer">Loan Officer</Label>
              <Select
                value={filters.loanOfficer}
                onValueChange={(value) => handleFilterChange('loanOfficer', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Loan Officers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Loan Officers</SelectItem>
                  {loanOfficers.map((officer) => (
                    <SelectItem key={officer.id} value={officer.id}>
                      {officer.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => handleFilterChange('status', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="defaulted">Defaulted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => setFilters({
                  group: 'all',
                  branch: 'all',
                  loanOfficer: 'all',
                  status: 'all',
                  searchTerm: ''
                })}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Records */}
      <Card>
        <CardHeader>
          <CardTitle>Loan Payments Sheet</CardTitle>
          <CardDescription>
            Showing {filteredLoans.length} loans
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLoans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No loans found matching your filters
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Select</TableHead>
                    <TableHead>Member Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Loan ID</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Installment</TableHead>
                    <TableHead>Next Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Overdue</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLoans.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedLoans.includes(loan.id)}
                          onCheckedChange={(checked) =>
                            handleLoanSelect(loan.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {loan.member_name}
                      </TableCell>
                      <TableCell>
                        {loan.member_phone}
                      </TableCell>
                      <TableCell>
                        {loan.group_name}
                      </TableCell>
                      <TableCell>
                        {loan.branch_name}
                      </TableCell>
                      <TableCell className="font-medium">
                        {loan.id.slice(-8)}
                      </TableCell>
                      <TableCell>
                        KES {loan.principal_amount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        KES {loan.current_balance.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        KES {loan.installment_amount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(loan.next_payment_date).toLocaleDateString()}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(loan.status)}
                      </TableCell>
                      <TableCell>
                        {getOverdueBadge(loan.is_overdue, loan.overdue_amount, loan.status)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          disabled={loan.status === 'repaid' || loan.status === 'completed'}
                          onClick={() => {
                            setIndividualPayment({
                              ...individualPayment,
                              loan_id: loan.id,
                              amount: loan.installment_amount
                            });
                            setIsPaymentModalOpen(true);
                          }}
                        >
                          {loan.status === 'repaid' || loan.status === 'completed' ? 'Completed' : 'Record Payment'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {selectedLoans.length > 0 && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Bulk Payment ({selectedLoans.length} selected)</CardTitle>
                    <CardDescription>
                      Process payments for selected loans
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="bulk_notes">Notes (Optional)</Label>
                      <Input
                        id="bulk_notes"
                        value={bulkPayment.notes}
                        onChange={(e) => setBulkPayment({
                          ...bulkPayment,
                          notes: e.target.value
                        })}
                        placeholder="Add payment notes..."
                      />
                    </div>
                    <Button
                      onClick={handleBulkPayment}
                      disabled={submitting}
                      className="w-full"
                    >
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Process Bulk Payment ({selectedLoans.length} loans)
                    </Button>
                  </CardContent>
                </Card>
              )}

            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Modal */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment for the selected loan
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  value={individualPayment.amount}
                  onChange={(e) => setIndividualPayment({
                    ...individualPayment,
                    amount: parseFloat(e.target.value) || 0
                  })}
                  placeholder="Enter payment amount"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={individualPayment.notes}
                onChange={(e) => setIndividualPayment({
                  ...individualPayment,
                  notes: e.target.value
                })}
                placeholder="Add payment notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPaymentModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleIndividualPayment}
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReceivePayments;