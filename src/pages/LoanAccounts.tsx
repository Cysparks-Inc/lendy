import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Plus, Eye, Edit, CreditCard, Calendar, DollarSign, Users, Landmark, Banknote, AlertCircle, Loader2, UserCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// --- Interfaces ---
interface LoanAccount {
  id: string;
  principal_amount: number;
  interest_rate: number;
  issue_date: string;
  due_date: string;
  status: 'active' | 'repaid' | 'defaulted' | 'pending';
  customer_id: string;
  member_name?: string;
  branch_name?: string;
  branch_id?: number;
  loan_officer_name?: string;
  total_paid: number;
  total_due: number;
}

interface Member {
  id: string;
  full_name: string;
  branch_id: number;
  group_id: number;
}

interface Branch {
  id: number;
  name: string;
}

interface Group {
  id: number;
  name: string;
}

interface LoanOfficer {
    id: string;
    full_name: string;
}

const LoanAccounts = () => {
  const { user, isSuperAdmin } = useAuth();
  const [loans, setLoans] = useState<LoanAccount[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loanOfficers, setLoanOfficers] = useState<LoanOfficer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<LoanAccount | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [newLoan, setNewLoan] = useState({
    customer_id: '',
    principal_amount: '',
    interest_rate: '10', // Default interest rate
    due_date: '',
    loan_officer_id: '',
  });

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      await Promise.all([fetchLoans(), fetchBranches(), fetchMembers(), fetchGroups(), fetchLoanOfficers()]);
      setLoading(false);
    };
    loadInitialData();
  }, []);

  const fetchLoans = async () => {
    try {
      const { data, error } = await supabase
        .from('loans_with_details')
        .select('*');

      if (error) throw error;

      const loansWithCalcs = data.map(loan => {
        const interest = loan.principal_amount * (loan.interest_rate / 100);
        const totalDue = loan.principal_amount + interest;
        
        return {
          ...loan,
          total_due: totalDue,
        };
      });
      setLoans(loansWithCalcs);
    } catch (error: any) {
      toast.error('Failed to fetch loans', { description: error.message });
    }
  };

  const fetchRelatedData = async (table, setter) => {
    const { data, error } = await supabase.from(table).select('*');
    if (error) toast.error(`Failed to fetch ${table}`);
    else setter(data || []);
  };

  const fetchLoanOfficers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'loan_officer');
    if (error) toast.error('Failed to fetch loan officers');
    else setLoanOfficers(data || []);
  };

  const fetchBranches = () => fetchRelatedData('branches', setBranches);
  const fetchMembers = () => fetchRelatedData('members', setMembers);
  const fetchGroups = () => fetchRelatedData('groups', setGroups);

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');

    const selectedMember = members.find(m => m.id === newLoan.customer_id);
    if (!selectedMember) {
        setSubmitError("Please select a valid member.");
        setIsSubmitting(false);
        return;
    }

    try {
      const { error } = await supabase.from('loans').insert({
        customer_id: newLoan.customer_id,
        principal_amount: parseFloat(newLoan.principal_amount),
        interest_rate: parseFloat(newLoan.interest_rate),
        interest_type: 'simple',
        repayment_schedule: 'monthly',
        due_date: newLoan.due_date,
        branch_id: selectedMember.branch_id,
        group_id: selectedMember.group_id,
        loan_officer_id: newLoan.loan_officer_id || null,
        created_by: user?.id,
        status: 'active',
        issue_date: new Date().toISOString(),
        current_balance: parseFloat(newLoan.principal_amount) * (1 + (parseFloat(newLoan.interest_rate)/100))
      });

      if (error) throw error;

      toast.success('Loan created successfully!');
      setIsDialogOpen(false);
      setNewLoan({ customer_id: '', principal_amount: '', interest_rate: '10', due_date: '', loan_officer_id: '' });
      await fetchLoans();
    } catch (error: any) {
      setSubmitError(error.message || 'An unknown error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredLoans = loans.filter(loan => {
    const matchesSearch = (loan.member_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || loan.status === statusFilter;
    const matchesBranch = branchFilter === 'all' || loan.branch_name === branchFilter;
    return matchesSearch && matchesStatus && matchesBranch;
  });

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Loan Management</h1>
          <p className="text-muted-foreground mt-1">Track and manage all loan accounts.</p>
        </div>
        {isSuperAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Loan</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create New Loan</DialogTitle><DialogDescription>Disburse a new loan to an active member.</DialogDescription></DialogHeader>
              {submitError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{submitError}</AlertDescription></Alert>}
              <form onSubmit={handleCreateLoan} className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="customer_id">Member</Label>
                  <Select value={newLoan.customer_id} onValueChange={(v) => setNewLoan({...newLoan, customer_id: v})}><SelectTrigger id="customer_id"><SelectValue placeholder="Select a Member" /></SelectTrigger><SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}</SelectContent></Select>
                </div>
                <div>
                  <Label htmlFor="loan_officer_id">Loan Officer (Optional)</Label>
                  <Select value={newLoan.loan_officer_id} onValueChange={(v) => setNewLoan({...newLoan, loan_officer_id: v})}><SelectTrigger id="loan_officer_id"><SelectValue placeholder="Assign an Officer" /></SelectTrigger><SelectContent>{loanOfficers.map(o => <SelectItem key={o.id} value={o.id}>{o.full_name}</SelectItem>)}</SelectContent></Select>
                </div>
                <div>
                  <Label htmlFor="principal_amount">Principal Amount (KES)</Label>
                  <Input id="principal_amount" type="number" placeholder="e.g., 50000" value={newLoan.principal_amount} onChange={e => setNewLoan({...newLoan, principal_amount: e.target.value})} required />
                </div>
                <div>
                  <Label htmlFor="interest_rate">Interest Rate (%)</Label>
                  <Input id="interest_rate" type="number" placeholder="e.g., 10" value={newLoan.interest_rate} onChange={e => setNewLoan({...newLoan, interest_rate: e.target.value})} required />
                </div>
                <div>
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input id="due_date" type="date" value={newLoan.due_date} onChange={e => setNewLoan({...newLoan, due_date: e.target.value})} required />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Loan</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Total Loans" value={loans.length} icon={CreditCard} />
        <StatCard title="Active Loans" value={loans.filter(l => l.status === 'active').length} icon={Banknote} />
        <StatCard title="Total Disbursed" value={formatCurrency(loans.reduce((s, l) => s + l.principal_amount, 0))} icon={Landmark} />
        <StatCard title="Total Outstanding" value={formatCurrency(loans.reduce((s, l) => s + (l.total_due - l.total_paid), 0))} icon={DollarSign} />
      </div>

      <Card>
        <CardHeader>
            <div className="flex flex-col lg:flex-row justify-between gap-4">
                <div>
                    <CardTitle>Loan Portfolio</CardTitle>
                    <CardDescription>A complete overview of all loan accounts.</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search by member name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
                    </div>
                    <Select value={branchFilter} onValueChange={setBranchFilter}><SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Branches" /></SelectTrigger><SelectContent><SelectItem value="all">All Branches</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}</SelectContent></Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="repaid">Repaid</SelectItem><SelectItem value="defaulted">Defaulted</SelectItem></SelectContent></Select>
                </div>
            </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Principal</TableHead><TableHead>Total Due</TableHead><TableHead>Repayment Progress</TableHead><TableHead>Due Date</TableHead><TableHead className="text-center">Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={7} className="text-center h-24">Loading loans...</TableCell></TableRow> :
                filteredLoans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell>
                        <div className="font-medium">{loan.member_name}</div>
                        <div className="text-sm text-muted-foreground">{loan.branch_name}</div>
                    </TableCell>
                    <TableCell className="font-mono">{formatCurrency(loan.principal_amount)}</TableCell>
                    <TableCell className="font-mono">{formatCurrency(loan.total_due)}</TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2">
                            <Progress value={(loan.total_paid / loan.total_due) * 100} className="w-24 h-2" />
                            <span className="text-sm font-medium">{((loan.total_paid / loan.total_due) * 100 || 0).toFixed(0)}%</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{formatCurrency(loan.total_paid)} paid</div>
                    </TableCell>
                    <TableCell>{new Date(loan.due_date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-center"><Badge variant={loan.status === 'defaulted' ? 'destructive' : 'outline'} className="capitalize">{loan.status}</Badge></TableCell>
                    <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setSelectedLoan(loan)}><Eye className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      {/* Loan Details Modal */}
      <Dialog open={!!selectedLoan} onOpenChange={() => setSelectedLoan(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Loan Details</DialogTitle>
            <DialogDescription>
              Full summary for loan to {selectedLoan?.member_name}.
            </DialogDescription>
          </DialogHeader>
          {selectedLoan && (
            <div className="grid grid-cols-2 gap-4 pt-4">
              <InfoItem label="Member" value={selectedLoan.member_name} />
              <InfoItem label="Branch" value={selectedLoan.branch_name} />
              <InfoItem label="Loan Officer" value={selectedLoan.loan_officer_name || 'N/A'} />
              <InfoItem label="Status" value={<Badge variant={selectedLoan.status === 'defaulted' ? 'destructive' : 'outline'} className="capitalize">{selectedLoan.status}</Badge>} />
              <InfoItem label="Principal Amount" value={formatCurrency(selectedLoan.principal_amount)} />
              <InfoItem label="Interest Rate" value={`${selectedLoan.interest_rate}%`} />
              <InfoItem label="Total Due" value={formatCurrency(selectedLoan.total_due)} />
              <InfoItem label="Total Paid" value={formatCurrency(selectedLoan.total_paid)} />
              <InfoItem label="Outstanding Balance" value={formatCurrency(selectedLoan.total_due - selectedLoan.total_paid)} />
              <InfoItem label="Issue Date" value={new Date(selectedLoan.issue_date).toLocaleDateString()} />
              <InfoItem label="Due Date" value={new Date(selectedLoan.due_date).toLocaleDateString()} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// --- Helper Components ---
const StatCard = ({ title, value, icon: Icon }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

const InfoItem = ({ label, value }) => (
  <div className="flex flex-col">
    <Label className="text-sm text-muted-foreground">{label}</Label>
    <div className="font-medium">{value}</div>
  </div>
);

export default LoanAccounts;

