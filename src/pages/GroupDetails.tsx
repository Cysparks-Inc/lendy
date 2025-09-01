import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  ArrowLeft, 
  CreditCard,
  Download,
  Users,
  Building2,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
interface Group {
  id: number;
  name: string;
  description: string;
  branch_id: number;
  branch_name: string;
  meeting_day: number;
  created_at: string;
  member_count: number;
}

interface GroupTransaction {
  id: string;
  member_name: string;
  program_name: string;
  disbursed_date: string;
  outstanding_amount: number;
  loan_collection: number;
  as_on_outstanding: number;
  member_id: string;
  loan_id: string;
  status: string;
}

const GroupDetails: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  
  // State
  const [group, setGroup] = useState<Group | null>(null);
  const [groupTransactions, setGroupTransactions] = useState<GroupTransaction[]>([]);
  const [groupMembersCount, setGroupMembersCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [bulkPaymentDialog, setBulkPaymentDialog] = useState(false);
  const [bulkPaymentAmount, setBulkPaymentAmount] = useState('');
  const [isProcessingBulkPayment, setIsProcessingBulkPayment] = useState(false);

  // Fetch group data
  const fetchGroupData = async () => {
    if (!groupId) return;
    
    try {
      setLoading(true);
      
      // Fetch group details
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select(`
          *,
          branches!inner(name)
        `)
        .eq('id', groupId)
        .single();
      
      if (groupError) throw groupError;
      
      const groupWithData = {
        ...groupData,
        branch_name: groupData.branches?.name || 'Unknown'
      };
      
      setGroup(groupWithData);
      
      // Fetch group members count
      await fetchGroupMembersCount(groupWithData);
      
      // Fetch group transactions
      await fetchGroupTransactions(groupWithData);
      
    } catch (error: any) {
      console.error('Failed to fetch group data:', error);
      toast.error('Failed to load group data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch group members count
  const fetchGroupMembersCount = async (groupData: Group) => {
    try {
      const { count, error } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupData.id);
      
      if (error) throw error;
      
      setGroupMembersCount(count || 0);
    } catch (error) {
      console.error('Failed to fetch group members count:', error);
      setGroupMembersCount(0);
    }
  };

  const fetchGroupTransactions = async (groupData: Group) => {
    try {
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('id, full_name')
        .eq('group_id', groupData.id);
      
      if (membersError) throw membersError;
      
      if (!membersData || membersData.length === 0) {
        setGroupTransactions([]);
        return;
      }
      
      const memberIds = membersData.map(m => m.id);
      
      const { data: loansData, error: loansError } = await supabase
        .from('loans')
        .select(`
          id,
          customer_id,
          principal_amount,
          interest_disbursed,
          processing_fee,
          total_paid,
          current_balance,
          status,
          issue_date,
          loan_program
        `)
        .in('customer_id', memberIds);
      
      if (loansError) throw loansError;
      
      const transactions: GroupTransaction[] = (loansData || []).map(loan => {
        const member = membersData.find(m => m.id === loan.customer_id);
        const totalAmount = (loan.principal_amount || 0) + (loan.interest_disbursed || 0) + (loan.processing_fee || 0);
        
        return {
          id: `${loan.id}-${loan.customer_id}`,
          member_name: member?.full_name || 'Unknown Member',
          program_name: loan.loan_program || 'Small Loan',
          disbursed_date: loan.issue_date || new Date().toISOString().split('T')[0],
          outstanding_amount: totalAmount,
          loan_collection: loan.total_paid || 0,
          as_on_outstanding: loan.current_balance || 0,
          member_id: loan.customer_id,
          loan_id: loan.id,
          status: loan.status || 'pending'
        };
      });
      
      setGroupTransactions(transactions);
      
    } catch (error) {
      console.error('Failed to fetch group transactions:', error);
      toast.error('Failed to load group transactions');
    }
  };

  // Handle individual payment recording
  const handleRecordPayment = (memberId: string, loanId: string) => {
    navigate(`/loans/${loanId}?fromGroup=${groupId}`);
  };

  // Handle bulk payment recording
  const handleBulkPayment = async () => {
    if (selectedMembers.length === 0 || !bulkPaymentAmount) return;
    
    const amount = parseFloat(bulkPaymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    
    setIsProcessingBulkPayment(true);
    try {
      navigate(`/bulk-payment?group=${groupId}&members=${selectedMembers.join(',')}&amount=${amount}`);
    } catch (error: any) {
      console.error('Failed to process bulk payment:', error);
      toast.error('Failed to process bulk payment');
    } finally {
      setIsProcessingBulkPayment(false);
      setBulkPaymentDialog(false);
    }
  };

  // Handle member selection for bulk operations
  const handleMemberSelection = (memberId: string) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  // Handle select all members
  const handleSelectAll = () => {
    if (selectedMembers.length === groupTransactions.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(groupTransactions.map(t => t.member_id));
    }
  };

  // PDF Export function
  const handleExportPDF = async () => {
    if (!group || groupTransactions.length === 0) return;
    
    try {
      // Dynamic import of jsPDF
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(20);
      doc.text('Group Transaction Sheet', 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text(`Group: ${group.name}`, 20, 35);
      doc.text(`Branch: ${group.branch_name}`, 20, 45);
      doc.text(`Meeting Day: ${getDayName(group.meeting_day)}`, 20, 55);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 65);
      
      // Table headers
      const headers = ['P#', 'Member Name', 'Program', 'Disbursed Date', 'Outstanding', 'Collection', 'As On Outstanding'];
      const data = groupTransactions.map((transaction, index) => [
        index + 1,
        transaction.member_name,
        transaction.program_name,
        new Date(transaction.disbursed_date).toLocaleDateString('en-GB'),
        formatCurrency(transaction.outstanding_amount),
        transaction.loan_collection > 0 ? formatCurrency(transaction.loan_collection) : '-',
        formatCurrency(transaction.as_on_outstanding)
      ]);
      
      // Add totals row
      data.push(['', '', '', '', 'Total', '', formatCurrency(totalOutstanding)]);
      data.push(['', '', '', '', 'Total', '', formatCurrency(totalAsOnOutstanding)]);
      
      autoTable(doc, {
        head: [headers],
        body: data,
        startY: 80,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 139, 202] }
      });
      
      doc.save(`${group.name}_transaction_sheet_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF exported successfully!');
    } catch (error) {
      console.error('PDF export failed:', error);
      toast.error('Failed to export PDF. Please try again.');
    }
  };

  // Helper functions
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', { 
      style: 'currency', 
      currency: 'KES' 
    }).format(amount || 0);
  };

  const getDayName = (dayNumber: number) => {
    const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[dayNumber] || 'Unknown';
  };

  // Calculate totals
  const totalOutstanding = groupTransactions.reduce((sum, t) => sum + t.outstanding_amount, 0);
  const totalAsOnOutstanding = groupTransactions.reduce((sum, t) => sum + t.as_on_outstanding, 0);

  useEffect(() => {
    fetchGroupData();
  }, [groupId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Group Not Found</h2>
          <p className="text-muted-foreground">The requested group could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          onClick={() => navigate('/groups')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Groups
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
          <p className="text-muted-foreground">Group Transaction Sheet & Management</p>
        </div>
      </div>

      {/* Group Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{groupMembersCount}</div>
            <div className="text-sm text-gray-600">Total Members</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{groupTransactions.length}</div>
            <div className="text-sm text-gray-600">Active Loans</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(totalOutstanding)}</div>
            <div className="text-sm text-gray-600">Total Outstanding</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(totalAsOnOutstanding)}</div>
            <div className="text-sm text-gray-600">As On Outstanding</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-indigo-600">{getDayName(group.meeting_day)}</div>
            <div className="text-sm text-gray-600">Meeting Day</div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => setBulkPaymentDialog(true)}
          disabled={groupTransactions.length === 0}
          className="flex items-center gap-2"
        >
          <CreditCard className="h-4 w-4" />
          Record Bulk Payment
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate(`/groups/${groupId}/members`)}
          className="flex items-center gap-2"
        >
          <Users className="h-4 w-4" />
          Manage Members
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate(`/groups/${groupId}/edit`)}
          className="flex items-center gap-2"
        >
          <Building2 className="h-4 w-4" />
          Edit Group
        </Button>
      </div>

      {/* Transaction Sheet */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Group Transaction Sheet</CardTitle>
              <CardDescription>
                {group.name} - {group.branch_name} - {getDayName(group.meeting_day)}
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleExportPDF}
              disabled={groupTransactions.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {groupTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-r">
                      <Checkbox 
                        checked={selectedMembers.length === groupTransactions.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-r">P#</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-r">Member Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-r">Program</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-r">Disbursed Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-r">Outstanding</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-r">Collection</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-r">As On Outstanding</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupTransactions.map((transaction, index) => (
                    <tr key={transaction.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 border-r">
                        <Checkbox 
                          checked={selectedMembers.includes(transaction.member_id)}
                          onCheckedChange={() => handleMemberSelection(transaction.member_id)}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r">{index + 1}</td>
                      <td className="px-4 py-3 border-r">
                        <span className="font-medium text-blue-600">{transaction.member_name}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 border-r">{transaction.program_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 border-r">
                        {new Date(transaction.disbursed_date).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r">
                        {formatCurrency(transaction.outstanding_amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 border-r">
                        {transaction.loan_collection > 0 ? formatCurrency(transaction.loan_collection) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r">
                        {formatCurrency(transaction.as_on_outstanding)}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          onClick={() => handleRecordPayment(transaction.member_id, transaction.loan_id)}
                          className="flex items-center gap-1"
                        >
                          <CreditCard className="h-3 w-3" />
                          Record Payment
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr className="font-medium">
                    <td className="px-4 py-3 border-r"></td>
                    <td className="px-4 py-3 border-r"></td>
                    <td className="px-4 py-3 border-r"></td>
                    <td className="px-4 py-3 border-r"></td>
                    <td className="px-4 py-3 border-r"></td>
                    <td className="px-4 py-3 text-sm border-r">Total</td>
                    <td className="px-4 py-3 text-sm border-r">-</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{formatCurrency(totalOutstanding)}</td>
                    <td></td>
                  </tr>
                  <tr className="font-medium">
                    <td className="px-4 py-3 border-r"></td>
                    <td className="px-4 py-3 border-r"></td>
                    <td className="px-4 py-3 border-r"></td>
                    <td className="px-4 py-3 border-r"></td>
                    <td className="px-4 py-3 border-r"></td>
                    <td className="px-4 py-3 text-sm border-r">Total</td>
                    <td className="px-4 py-3 text-sm border-r">-</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{formatCurrency(totalAsOnOutstanding)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center py-16 text-gray-500">
              <CreditCard className="mx-auto h-16 w-16 mb-4 text-gray-400" />
              <p className="text-lg font-medium text-gray-600">No transactions found</p>
              <p className="text-sm text-gray-500">This group has no active loans</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Payment Dialog */}
      <Dialog open={bulkPaymentDialog} onOpenChange={setBulkPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Bulk Payment</DialogTitle>
            <DialogDescription>
              Record payment for {selectedMembers.length} selected member(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulkAmount">Payment Amount (KES)</Label>
              <Input
                id="bulkAmount"
                type="number"
                value={bulkPaymentAmount}
                onChange={(e) => setBulkPaymentAmount(e.target.value)}
                placeholder="Enter payment amount"
                min="0"
                step="0.01"
              />
            </div>
            <div className="text-sm text-gray-600">
              <p>Selected members: {selectedMembers.length}</p>
              <p>Amount per member: {bulkPaymentAmount ? formatCurrency(parseFloat(bulkPaymentAmount) / selectedMembers.length) : '-'}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkPaymentDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleBulkPayment}
              disabled={!bulkPaymentAmount || isProcessingBulkPayment}
            >
              {isProcessingBulkPayment ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Record Bulk Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroupDetails;
