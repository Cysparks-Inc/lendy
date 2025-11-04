import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { Loader2, Search, Calendar, DollarSign, Users, UserCheck, Building, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

interface TodaysPayment {
  id: string;
  loan_id: string;
  installment_number: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  total_amount: number;
  amount_paid: number;
  is_paid: boolean;
  // Loan details
  loan_principal_amount: number;
  loan_interest_disbursed: number;
  loan_current_balance: number;
  loan_status: string;
  loan_application_no: string;
  loan_program: string;
  // Member details
  member_id: string;
  member_name: string;
  member_phone: string;
  member_account_number: string;
  // Group details
  group_id: string | null;
  group_name: string | null;
  // Branch details
  branch_id: string | null;
  branch_name: string | null;
  // Loan officer details
  loan_officer_id: string | null;
  loan_officer_name: string | null;
}

const TodaysPayments: React.FC = () => {
  const { user, userRole, profile } = useAuth();
  const navigate = useNavigate();
  const [payments, setPayments] = useState<TodaysPayment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<TodaysPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user) {
      fetchTodaysPayments();
    }
  }, [user, userRole, profile]);

  useEffect(() => {
    filterPayments();
  }, [payments, searchTerm]);

  const fetchTodaysPayments = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      // Step 1: Fetch installments due today that are not fully paid
      let installmentsQuery = supabase
        .from('loan_installments')
        .select(`
          id,
          loan_id,
          installment_number,
          due_date,
          principal_amount,
          interest_amount,
          total_amount,
          amount_paid,
          is_paid
        `)
        .eq('due_date', today)
        .or('is_paid.is.null,is_paid.eq.false');

      const { data: installments, error: installmentsError } = await installmentsQuery;

      if (installmentsError) throw installmentsError;

      if (!installments || installments.length === 0) {
        setPayments([]);
        setFilteredPayments([]);
        setLoading(false);
        return;
      }

      // Step 2: Get unique loan IDs
      const loanIds = [...new Set(installments.map(i => i.loan_id))];

      // Step 3: Fetch loans with related data
      let loansQuery = supabase
        .from('loans')
        .select(`
          id,
          principal_amount,
          interest_disbursed,
          current_balance,
          status,
          application_no,
          loan_program,
          member_id,
          group_id,
          branch_id,
          loan_officer_id
        `)
        .in('id', loanIds)
        .eq('is_deleted', false);

      // Apply role-based filtering at database level
      if (userRole === 'loan_officer') {
        loansQuery = loansQuery.or(`loan_officer_id.eq.${user.id},loan_officer_id.is.null`);
      } else if (userRole === 'branch_admin' && profile?.branch_id) {
        loansQuery = loansQuery.eq('branch_id', profile.branch_id);
      } else if (userRole !== 'super_admin' && profile?.branch_id) {
        loansQuery = loansQuery.eq('branch_id', profile.branch_id);
      }

      const { data: loans, error: loansError } = await loansQuery;

      if (loansError) throw loansError;

      if (!loans || loans.length === 0) {
        setPayments([]);
        setFilteredPayments([]);
        setLoading(false);
        return;
      }

      // Step 4: Get unique member IDs, group IDs, branch IDs, and loan officer IDs
      const memberIds = [...new Set(loans.map(l => l.member_id).filter(Boolean))];
      const groupIds = [...new Set(loans.map(l => l.group_id).filter(Boolean))];
      const branchIds = [...new Set(loans.map(l => l.branch_id).filter(Boolean))];
      const officerIds = [...new Set(loans.map(l => l.loan_officer_id).filter(Boolean))];

      // Step 5: Fetch members
      const { data: members, error: membersError } = await supabase
        .from('members')
        .select('id, first_name, last_name, phone_number, member_no, assigned_officer_id')
        .in('id', memberIds);

      if (membersError) throw membersError;

      // Step 6: Apply additional role-based filtering for loan officers (check member assignment)
      let filteredLoans = loans;
      if (userRole === 'loan_officer') {
        const membersMap = new Map((members || []).map(m => [m.id, m]));
        filteredLoans = loans.filter(loan => {
          const member = membersMap.get(loan.member_id);
          // If loan has no officer, check if member is assigned to this officer
          if (!loan.loan_officer_id && member) {
            return member.assigned_officer_id === user.id;
          }
          // If loan has an officer, it must match (already filtered above)
          return loan.loan_officer_id === user.id;
        });
      }

      // Step 7: Fetch groups
      let groups: any[] = [];
      if (groupIds.length > 0) {
        const { data: groupsData, error: groupsError } = await supabase
          .from('groups')
          .select('id, name')
          .in('id', groupIds);
        if (!groupsError) groups = groupsData || [];
      }

      // Step 8: Fetch branches
      let branches: any[] = [];
      if (branchIds.length > 0) {
        const { data: branchesData, error: branchesError } = await supabase
          .from('branches')
          .select('id, name')
          .in('id', branchIds);
        if (!branchesError) branches = branchesData || [];
      }

      // Step 9: Fetch loan officers
      let loanOfficers: any[] = [];
      if (officerIds.length > 0) {
        const { data: officersData, error: officersError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', officerIds);
        if (!officersError) loanOfficers = officersData || [];
      }

      // Step 10: Create lookup maps
      const membersMap = new Map((members || []).map(m => [
        m.id,
        {
          name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Unknown Member',
          phone: m.phone_number || '',
          member_no: m.member_no || ''
        }
      ]));

      const groupsMap = new Map(groups.map(g => [g.id, g.name]));
      const branchesMap = new Map(branches.map(b => [b.id, b.name]));
      const loanOfficersMap = new Map(loanOfficers.map(o => [o.id, o.full_name]));

      // Step 11: Combine installments with loan and related data
      const paymentsData: TodaysPayment[] = installments
        .filter(inst => filteredLoans.some(loan => loan.id === inst.loan_id))
        .map(inst => {
          const loan = filteredLoans.find(l => l.id === inst.loan_id);
          if (!loan) return null;

          const member = membersMap.get(loan.member_id);
          const groupName = loan.group_id ? groupsMap.get(loan.group_id) : null;
          const branchName = loan.branch_id ? branchesMap.get(loan.branch_id) : null;
          const officerName = loan.loan_officer_id ? loanOfficersMap.get(loan.loan_officer_id) : null;

          // Calculate remaining amount to pay for this installment
          const remainingAmount = inst.total_amount - (inst.amount_paid || 0);

          return {
            id: inst.id,
            loan_id: inst.loan_id,
            installment_number: inst.installment_number,
            due_date: inst.due_date,
            principal_amount: inst.principal_amount,
            interest_amount: inst.interest_amount,
            total_amount: inst.total_amount,
            amount_paid: inst.amount_paid || 0,
            is_paid: inst.is_paid || false,
            loan_principal_amount: loan.principal_amount || 0,
            loan_interest_disbursed: loan.interest_disbursed || 0,
            loan_current_balance: loan.current_balance || 0,
            loan_status: loan.status || '',
            loan_application_no: loan.application_no || '',
            loan_program: loan.loan_program || '',
            member_id: loan.member_id,
            member_name: member?.name || 'Unknown Member',
            member_phone: member?.phone || '',
            member_account_number: member?.member_no || '',
            group_id: loan.group_id,
            group_name: groupName || null,
            branch_id: loan.branch_id,
            branch_name: branchName || null,
            loan_officer_id: loan.loan_officer_id,
            loan_officer_name: officerName || null
          };
        })
        .filter((p): p is TodaysPayment => p !== null && (p.total_amount - p.amount_paid) > 0); // Only show installments with remaining amount

      setPayments(paymentsData);
    } catch (error: any) {
      console.error('Error fetching today\'s payments:', error);
      toast.error('Failed to fetch today\'s payments', { description: error.message });
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const filterPayments = () => {
    let filtered = [...payments];

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(payment =>
        payment.member_name.toLowerCase().includes(searchLower) ||
        payment.member_phone.toLowerCase().includes(searchLower) ||
        payment.member_account_number.toLowerCase().includes(searchLower) ||
        payment.loan_application_no.toLowerCase().includes(searchLower) ||
        (payment.group_name && payment.group_name.toLowerCase().includes(searchLower)) ||
        (payment.loan_officer_name && payment.loan_officer_name.toLowerCase().includes(searchLower))
      );
    }

    setFilteredPayments(filtered);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);
  };

  const handleCollectPayment = (loanId: string) => {
    navigate(`/loans/${loanId}`);
  };

  const columns = [
    {
      header: 'Member',
      cell: (row: TodaysPayment) => (
        <div className="space-y-1">
          <Link to={`/members/${row.member_id}`} className="font-medium text-primary hover:underline block">
            {row.member_name}
          </Link>
          <div className="text-xs text-muted-foreground">{row.member_phone}</div>
          <div className="text-xs text-muted-foreground">Account: {row.member_account_number || 'N/A'}</div>
        </div>
      )
    },
    {
      header: 'Loan Details',
      cell: (row: TodaysPayment) => (
        <div className="space-y-1">
          <Link to={`/loans/${row.loan_id}`} className="font-mono text-xs hover:underline block">
            {row.loan_application_no}
          </Link>
          <Badge variant="outline" className="text-xs capitalize">
            {row.loan_program.replace('_', ' ')}
          </Badge>
          <div className="text-xs text-muted-foreground">
            Principal: {formatCurrency(row.loan_principal_amount)}
          </div>
          <div className="text-xs text-muted-foreground">
            Balance: {formatCurrency(row.loan_current_balance)}
          </div>
        </div>
      )
    },
    {
      header: 'Installment',
      cell: (row: TodaysPayment) => (
        <div className="space-y-1">
          <div className="font-semibold">{formatCurrency(row.total_amount)}</div>
          <div className="text-xs text-muted-foreground">
            #{row.installment_number} Due: {new Date(row.due_date).toLocaleDateString()}
          </div>
          {row.amount_paid > 0 && (
            <div className="text-xs text-muted-foreground">
              Paid: {formatCurrency(row.amount_paid)} / Remaining: {formatCurrency(row.total_amount - row.amount_paid)}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Group',
      cell: (row: TodaysPayment) => (
        <div className="font-medium text-sm">{row.group_name || 'No Group'}</div>
      )
    },
    {
      header: 'Loan Officer',
      cell: (row: TodaysPayment) => (
        <div className="font-medium text-sm">{row.loan_officer_name || 'Unassigned'}</div>
      )
    },
    {
      header: 'Branch',
      cell: (row: TodaysPayment) => (
        <div className="font-medium text-sm">{row.branch_name || 'No Branch'}</div>
      )
    },
    {
      header: 'Actions',
      cell: (row: TodaysPayment) => (
        <Button
          onClick={() => handleCollectPayment(row.loan_id)}
          size="sm"
          className="w-full"
        >
          <CreditCard className="h-4 w-4 mr-2" />
          Collect Payment
        </Button>
      )
    }
  ];

  const totalAmount = filteredPayments.reduce((sum, p) => sum + (p.total_amount - p.amount_paid), 0);
  const totalInstallments = filteredPayments.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Today's Payments</h1>
          <p className="text-muted-foreground">
            View and collect payments due today
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Installments</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInstallments}</div>
            <p className="text-xs text-muted-foreground">Due today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount Due</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
            <p className="text-xs text-muted-foreground">To be collected</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(filteredPayments.map(p => p.member_id)).size}
            </div>
            <p className="text-xs text-muted-foreground">With payments due</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Schedule</CardTitle>
          <CardDescription>
            Installments due on {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by member name, phone, account number, loan number, group, or loan officer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'No payments found matching your search.' : 'No payments due today.'}
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredPayments}
              searchKey="member_name"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TodaysPayments;

