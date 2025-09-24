import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, TrendingUp, DollarSign, Users, FileText, Download, Filter, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { ExportDropdown } from '@/components/ui/ExportDropdown';
import { DateRangeFilter, DateRange, filterDataByDateRange } from '@/components/ui/DateRangeFilter';

// --- Type Definitions ---

interface IncomeRecord {
  id: string;
  source: 'processing_fee' | 'interest' | 'registration_fee' | 'activation_fee';
  amount: number;
  description: string;
  member_name?: string;
  loan_id?: string;
  transaction_date: string;
  created_at: string;
  loan_officer_name?: string;
  group_id?: string;
  group_name?: string;
}

interface IncomeSummary {
  total_processing_fees: number;
  total_interest: number;
  total_registration_fees: number;
  total_activation_fees: number;
  total_income: number;
}

interface FilterState {
  incomeType: 'all' | 'processing_fee' | 'interest' | 'registration_fee' | 'activation_fee';
  memberName: string;
  loanOfficer: string;
  group: string;
}

const IncomePage: React.FC = () => {
  const { user, userRole } = useAuth();
    const [incomeRecords, setIncomeRecords] = useState<IncomeRecord[]>([]);
  const [incomeSummary, setIncomeSummary] = useState<IncomeSummary>({
    total_processing_fees: 0,
    total_interest: 0,
    total_registration_fees: 0,
    total_activation_fees: 0,
    total_income: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [loanOfficers, setLoanOfficers] = useState<{ id: string; full_name: string }[]>([]);
  
     // Filter state
   const [filters, setFilters] = useState<FilterState>({
     incomeType: 'all',
     memberName: '',
     loanOfficer: 'all',
     group: 'all'
   });
   const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  
  // Filtered records based on current filters
  const filteredRecords = React.useMemo(() => {
    return filterDataByDateRange(incomeRecords, dateRange, 'transaction_date').filter(record => {
      
             // Income type filter
       if (filters.incomeType && filters.incomeType !== 'all' && record.source !== filters.incomeType) {
         return false;
       }
      
      // Member name filter
      if (filters.memberName && record.member_name && 
          !record.member_name.toLowerCase().includes(filters.memberName.toLowerCase())) {
        return false;
      }
      
      // Loan officer filter
      if (filters.loanOfficer && filters.loanOfficer !== 'all') {
        // Get the loan officer name for the selected ID
        const selectedOfficer = loanOfficers.find(o => o.id === filters.loanOfficer);
        if (selectedOfficer && record.loan_officer_name !== selectedOfficer.full_name) {
          return false;
        }
      }
      
      // Group filter
      if (filters.group && filters.group !== 'all') {
        if (!record.group_id || String(record.group_id) !== String(filters.group)) {
          return false;
        }
      }
      
      return true;
    });
  }, [incomeRecords, filters, dateRange]);
   


  // Check if user is super admin or admin
  useEffect(() => {
    if (userRole !== 'super_admin' && userRole !== 'admin') {
      toast.error('Access Denied', { description: 'Only Super Admins and Admins can access this page.' });
      // Redirect to dashboard or show access denied message
      return;
    }
  }, [userRole]);

  useEffect(() => {
    if (userRole === 'super_admin' || userRole === 'admin') {
      fetchIncomeData();
    }
  }, [userRole]);

  const fetchIncomeData = async () => {
    setLoading(true);
    try {
      // Fetch income data from multiple sources
      const [processingFees, processingFeeTransactions, interestPayments, registrationFees, activationFees, allMembers, groupsData, loanOfficersData] = await Promise.all([
        // Processing fees from loans (direct)
        supabase
          .from('loans')
          .select('id, processing_fee, created_at, customer_id, approval_status, loan_officer_id')
          .eq('approval_status', 'approved')
          .not('processing_fee', 'is', null)
          .gt('processing_fee', 0),
        
        // Processing fees from transactions table (recorded by trigger function)
        supabase
          .from('transactions')
          .select('id, amount, description, transaction_date, created_at, loan_id, member_id')
          .eq('transaction_type', 'fee')
          .like('description', '%Processing Fee%'),
        
        // Interest payments from loan_payments
        supabase
          .from('loan_payments')
          .select('id, amount, payment_date, created_at, loan_id')
          .gt('amount', 0),
        
        // Registration fees from members
        supabase
          .from('members')
          .select('id, full_name, created_at, group_id, assigned_officer_id')
          .eq('registration_fee_paid', true),
        
        // Activation fees (to be implemented)
        supabase
          .from('members')
          .select('id, full_name, created_at, group_id, assigned_officer_id')
          .eq('activation_fee_paid', true),
        
        // All members for lookup
        supabase
          .from('members')
          .select('id, full_name, group_id'),
        
        // Groups for filtering
        supabase
          .from('groups')
          .select('id, name'),
        
        // Loan officers for filtering
        supabase
          .from('profiles')
          .select('id, full_name')
          .eq('role', 'loan_officer')
      ]);

      // Process and combine all income data
      const allIncome: IncomeRecord[] = [];
      
      // Helper function to get member name by ID
      const getMemberName = (memberId: string | null): string | null => {
        if (!memberId || !allMembers.data) return null;
        const member = allMembers.data.find(m => m.id === memberId);
        return member?.full_name || null;
      };

      // Helper function to get group info by member ID
      const getGroupInfo = (memberId: string | null): { group_id?: string; group_name?: string } => {
        if (!memberId || !allMembers.data || !groupsData.data) return {};
        const member = allMembers.data.find(m => m.id === memberId);
        if (!member?.group_id) return {};
        const group = groupsData.data.find(g => String(g.id) === String(member.group_id));
        return {
          group_id: String(member.group_id),
          group_name: group?.name || null
        };
      };

      // Helper function to get loan officer name by ID
      const getLoanOfficerName = (officerId: string | null): string | null => {
        if (!officerId || !loanOfficersData.data) return null;
        const officer = loanOfficersData.data.find(o => o.id === officerId);
        return officer?.full_name || null;
      };

      // Add processing fees from loans table (direct)
      if (processingFees.data) {
        processingFees.data.forEach(loan => {
          if (loan.processing_fee && loan.processing_fee > 0) {
            const groupInfo = getGroupInfo(loan.customer_id);
            allIncome.push({
              id: `pf-loan-${loan.id}`,
              source: 'processing_fee',
              amount: loan.processing_fee,
              description: 'Loan Processing Fee',
              member_name: getMemberName(loan.customer_id),
              loan_id: loan.id,
              transaction_date: loan.created_at,
              created_at: loan.created_at,
              group_id: groupInfo.group_id,
              group_name: groupInfo.group_name,
              loan_officer_name: getLoanOfficerName(loan.loan_officer_id)
            });
          }
        });
      }

      // Add processing fees from transactions table (recorded by trigger function)
      if (processingFeeTransactions.data) {
        processingFeeTransactions.data.forEach(transaction => {
          const groupInfo = getGroupInfo(transaction.member_id);
          allIncome.push({
            id: `pf-txn-${transaction.id}`,
            source: 'processing_fee',
            amount: transaction.amount,
            description: transaction.description,
            member_name: getMemberName(transaction.member_id),
            loan_id: transaction.loan_id,
            transaction_date: transaction.transaction_date,
            created_at: transaction.created_at,
            group_id: groupInfo.group_id,
            group_name: groupInfo.group_name
          });
        });
      }

            // Add interest payments
      if (interestPayments.data) {
        // Get loan details for interest payments
        const loanIds = interestPayments.data.map(payment => payment.loan_id).filter(Boolean);
        let loanDetails: any[] = [];
        
        if (loanIds.length > 0) {
          const { data: loansData } = await supabase
            .from('loans')
            .select('id, customer_id, loan_officer_id')
            .in('id', loanIds);
          loanDetails = loansData || [];
        }
        
        interestPayments.data.forEach(payment => {
          const loan = loanDetails.find(l => l.id === payment.loan_id);
          const groupInfo = getGroupInfo(loan?.customer_id);
          allIncome.push({
            id: `int-${payment.id}`,
            source: 'interest',
            amount: payment.amount,
            description: 'Interest Payment',
            member_name: getMemberName(loan?.customer_id),
            loan_id: payment.loan_id,
            transaction_date: payment.payment_date,
            created_at: payment.created_at,
            group_id: groupInfo.group_id,
            group_name: groupInfo.group_name,
            loan_officer_name: getLoanOfficerName(loan?.loan_officer_id)
          });
        });
      }

      // Add registration fees
      if (registrationFees.data) {
        registrationFees.data.forEach(member => {
          const groupInfo = getGroupInfo(member.id);
          allIncome.push({
            id: `reg-${member.id}`,
            source: 'registration_fee',
            amount: 500, // Fixed registration fee
            description: 'Member Registration Fee',
            member_name: member.full_name,
            transaction_date: member.created_at,
            created_at: member.created_at,
            group_id: groupInfo.group_id,
            group_name: groupInfo.group_name,
            loan_officer_name: getLoanOfficerName(member.assigned_officer_id)
          });
        });
      }

      // Add activation fees
      if (activationFees.data) {
        activationFees.data.forEach(member => {
          const groupInfo = getGroupInfo(member.id);
          allIncome.push({
            id: `act-${member.id}`,
            source: 'activation_fee',
            amount: 500, // Fixed activation fee
            description: 'Member Activation Fee',
            member_name: member.full_name,
            transaction_date: member.created_at,
            created_at: member.created_at,
            group_id: groupInfo.group_id,
            group_name: groupInfo.group_name,
            loan_officer_name: getLoanOfficerName(member.assigned_officer_id)
          });
        });
      }

      // Sort by date (newest first)
      allIncome.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
      
             setIncomeRecords(allIncome);
       

      // Calculate summary
      const summary = allIncome.reduce((acc, record) => {
        switch (record.source) {
          case 'processing_fee':
            acc.total_processing_fees += record.amount;
            break;
          case 'interest':
            acc.total_interest += record.amount;
            break;
          case 'registration_fee':
            acc.total_registration_fees += record.amount;
            break;
          case 'activation_fee':
            acc.total_activation_fees += record.amount;
            break;
        }
        acc.total_income += record.amount;
        return acc;
      }, {
        total_processing_fees: 0,
        total_interest: 0,
        total_registration_fees: 0,
        total_activation_fees: 0,
        total_income: 0
      });

      setIncomeSummary(summary);
      setGroups(groupsData.data || []);
      setLoanOfficers(loanOfficersData.data || []);

      // Debug logging to verify data
      console.log('Income Records with Group and Officer Info:', allIncome.slice(0, 3));
      console.log('Groups Data:', groupsData.data);
      console.log('Loan Officers Data:', loanOfficersData.data);

    } catch (error: any) {
      toast.error('Failed to fetch income data', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number): string => 
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);

  const formatDate = (dateString: string): string => 
    new Date(dateString).toLocaleDateString('en-KE');
    
  const formatDateForExport = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString('en-KE');
    } catch (error) {
      return dateString || 'N/A';
    }
  };
  
  const resetFilters = () => {
    setFilters({
      incomeType: 'all',
      memberName: '',
      loanOfficer: 'all',
      group: 'all'
    });
    setDateRange({ from: undefined, to: undefined });
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'processing_fee':
        return <FileText className="h-4 w-4" />;
      case 'interest':
        return <TrendingUp className="h-4 w-4" />;
      case 'registration_fee':
      case 'activation_fee':
        return <Users className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  const getSourceBadgeVariant = (source: string) => {
    switch (source) {
      case 'processing_fee':
        return 'default';
      case 'interest':
        return 'secondary';
      case 'registration_fee':
        return 'outline';
      case 'activation_fee':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const exportColumns = [
    { header: 'Date', accessorKey: (row: IncomeRecord) => formatDateForExport(row.transaction_date) },
    { header: 'Source', accessorKey: 'source' },
    { header: 'Description', accessorKey: 'description' },
    { header: 'Member', accessorKey: 'member_name' },
    { header: 'Amount (KES)', accessorKey: (row: IncomeRecord) => formatCurrency(row.amount) }
  ];

  if (userRole !== 'super_admin') {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
        <div className="max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">
            Only Super Admins can access the Income page.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Income Management</h1>
          <p className="text-muted-foreground">Track all income sources and financial performance</p>
        </div>
                                    <ExportDropdown 
           data={filteredRecords}
           columns={exportColumns}
           fileName="income_report"
           reportTitle="Income Report"
         />
             </div>

       {/* Filter Section */}
       <Card className="mb-6">
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Filter className="h-5 w-5" />
             Filter Income Data
           </CardTitle>
           <CardDescription>
             Filter income records by date range, income type, member name, loan officer, and group
           </CardDescription>
         </CardHeader>
         <CardContent>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
             {/* Date Range */}
             <div className="space-y-2">
               <Label>Date Range</Label>
               <DateRangeFilter
                 onDateRangeChange={setDateRange}
                 placeholder="Filter by date range"
                 showPresets={true}
               />
             </div>
             
             {/* Income Type */}
             <div className="space-y-2">
               <Label htmlFor="incomeType">Income Type</Label>
               <Select
                 value={filters.incomeType}
                 onValueChange={(value) => setFilters(prev => ({ ...prev, incomeType: value }))}
               >
                 <SelectTrigger>
                   <SelectValue placeholder="All Types" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Types</SelectItem>
                   <SelectItem value="processing_fee">Processing Fees</SelectItem>
                   <SelectItem value="interest">Interest</SelectItem>
                   <SelectItem value="registration_fee">Registration Fees</SelectItem>
                   <SelectItem value="activation_fee">Activation Fees</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             
             {/* Member Name */}
             <div className="space-y-2">
               <Label htmlFor="memberName">Member Name</Label>
               <Input
                 id="memberName"
                 placeholder="Search by member name..."
                 value={filters.memberName}
                 onChange={(e) => setFilters(prev => ({ ...prev, memberName: e.target.value }))}
               />
             </div>
             
             {/* Loan Officer */}
             <div className="space-y-2">
               <Label htmlFor="loanOfficer">Loan Officer</Label>
               <Select
                 value={filters.loanOfficer}
                 onValueChange={(value) => setFilters(prev => ({ ...prev, loanOfficer: value }))}
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
             
             {/* Group Filter */}
             <div className="space-y-2">
               <Label htmlFor="group">Group</Label>
               <Select
                 value={filters.group}
                 onValueChange={(value) => setFilters(prev => ({ ...prev, group: value }))}
               >
                 <SelectTrigger>
                   <SelectValue placeholder="All Groups" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Groups</SelectItem>
                   {groups.map((group) => (
                     <SelectItem key={group.id} value={group.id}>
                       {group.name}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
           </div>
           
           {/* Filter Actions */}
           <div className="flex justify-between items-center mt-4 pt-4 border-t">
             <div className="text-sm text-muted-foreground">
               Showing {filteredRecords.length} of {incomeRecords.length} records
             </div>
             <div className="flex gap-2">
               <Button variant="outline" onClick={resetFilters}>
                 Reset Filters
               </Button>
               <Button variant="outline" onClick={() => setActiveTab('overview')}>
                 View All
               </Button>
             </div>
           </div>
         </CardContent>
       </Card>

              {/* Income Summary Cards */}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
         <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Total Income</CardTitle>
             <DollarSign className="h-4 w-4 text-muted-foreground" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">{formatCurrency(filteredRecords.reduce((sum, record) => sum + record.amount, 0))}</div>
             <p className="text-xs text-muted-foreground mt-1">
               {filteredRecords.length === incomeRecords.length ? 'All records' : `${filteredRecords.length} filtered records`}
             </p>
           </CardContent>
         </Card>

                 <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Processing Fees</CardTitle>
             <FileText className="h-4 w-4 text-muted-foreground" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">{formatCurrency(filteredRecords.filter(r => r.source === 'processing_fee').reduce((sum, record) => sum + record.amount, 0))}</div>
           </CardContent>
         </Card>

                 <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Interest Income</CardTitle>
             <TrendingUp className="h-4 w-4 text-muted-foreground" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">{formatCurrency(filteredRecords.filter(r => r.source === 'interest').reduce((sum, record) => sum + record.amount, 0))}</div>
           </CardContent>
         </Card>

                 <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Registration Fees</CardTitle>
             <Users className="h-4 w-4 text-muted-foreground" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">{formatCurrency(filteredRecords.filter(r => r.source === 'registration_fee').reduce((sum, record) => sum + record.amount, 0))}</div>
           </CardContent>
         </Card>

         <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Activation Fees</CardTitle>
             <Users className="h-4 w-4 text-muted-foreground" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">{formatCurrency(filteredRecords.filter(r => r.source === 'activation_fee').reduce((sum, record) => sum + record.amount, 0))}</div>
           </CardContent>
         </Card>
      </div>

             {/* Tabs for different views */}
       <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
         <TabsList className="grid w-full grid-cols-5">
           <TabsTrigger value="overview">Overview</TabsTrigger>
           <TabsTrigger value="processing_fees">Processing Fees</TabsTrigger>
           <TabsTrigger value="interest">Interest Income</TabsTrigger>
           <TabsTrigger value="registration_fees">Registration Fees</TabsTrigger>
           <TabsTrigger value="activation_fees">Activation Fees</TabsTrigger>
         </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Income Transactions</CardTitle>
              <CardDescription>Complete history of all income sources</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Loan Officer</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                                     <TableBody>
                     {filteredRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{formatDate(record.transaction_date)}</TableCell>
                        <TableCell>
                          <Badge variant={getSourceBadgeVariant(record.source)}>
                            {getSourceIcon(record.source)}
                            <span className="ml-2 capitalize">{record.source.replace('_', ' ')}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>{record.description}</TableCell>
                        <TableCell>{record.member_name || 'N/A'}</TableCell>
                        <TableCell>{record.loan_officer_name || 'N/A'}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(record.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

                          {/* Individual source tabs */}
         {[
           { tabValue: 'processing_fees', sourceType: 'processing_fee' },
           { tabValue: 'interest', sourceType: 'interest' },
           { tabValue: 'registration_fees', sourceType: 'registration_fee' },
           { tabValue: 'activation_fees', sourceType: 'activation_fee' }
         ].map(({ tabValue, sourceType }) => {
           const sourceFilteredRecords = filteredRecords.filter(record => record.source === sourceType);
           
           return (
             <TabsContent key={tabValue} value={tabValue} className="space-y-4">
               <Card>
                 <CardHeader>
                   <CardTitle className="capitalize">{tabValue.replace('_', ' ')}</CardTitle>
                   <CardDescription>
                     Detailed breakdown of {tabValue.replace('_', ' ')} income ({sourceFilteredRecords.length} records)
                   </CardDescription>
                 </CardHeader>
               <CardContent>
                 <div className="overflow-x-auto">
                   <Table>
                     <TableHeader>
                       <TableRow>
                         <TableHead>Date</TableHead>
                         <TableHead>Description</TableHead>
                         <TableHead>Member</TableHead>
                         <TableHead>Loan Officer</TableHead>
                         <TableHead className="text-right">Amount</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {sourceFilteredRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>{formatDate(record.transaction_date)}</TableCell>
                            <TableCell>{record.description}</TableCell>
                            <TableCell>{record.member_name || 'N/A'}</TableCell>
                            <TableCell>{record.loan_officer_name || 'N/A'}</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(record.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                     </TableBody>
                   </Table>
                 </div>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
};

export default IncomePage;
