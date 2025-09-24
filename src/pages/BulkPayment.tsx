import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  ArrowLeft, 
  CreditCard,
  Users,
  Loader2,
  AlertCircle,
  CheckCircle,
  DollarSign
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
interface Member {
  id: string;
  full_name: string;
  id_number: string;
  phone_number: string;
  email: string;
  branch_id: number;
  branch_name: string;
}

interface Loan {
  id: string;
  customer_id: string;
  principal_amount: number;
  interest_disbursed: number;
  processing_fee: number;
  total_paid: number;
  current_balance: number;
  status: string;
  loan_program: string;
}

interface PaymentEntry {
  memberId: string;
  memberName: string;
  loanId: string;
  loanAmount: number;
  paymentAmount: string;
  isSelected: boolean;
}

const BulkPayment: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  
  // Get parameters from URL
  const groupId = searchParams.get('group');
  const memberIds = searchParams.get('members')?.split(',') || [];
  const totalAmount = parseFloat(searchParams.get('amount') || '0');
  
  // State
  const [members, setMembers] = useState<Member[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');

  // Fetch members and loans data
  const fetchData = async () => {
    if (memberIds.length === 0) return;
    
    try {
      setLoading(true);
      
      // Fetch members
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select(`
          *,
          branches!inner(name)
        `)
        .in('id', memberIds);
      
      if (membersError) throw membersError;
      
      const membersWithData = membersData?.map(member => ({
        ...member,
        branch_name: member.branches?.name || 'Unknown'
      })) || [];
      
      setMembers(membersWithData as any);
      
      // Fetch loans for these members
      const { data: loansData, error: loansError } = await supabase
        .from('loans')
        .select('*')
        .in('customer_id', memberIds);
      
      if (loansError) throw loansError;
      setLoans((loansData as any) || []);
      
      // Create payment entries
      const entries: PaymentEntry[] = membersWithData.map(member => {
        const memberLoan = loansData?.find(loan => loan.customer_id === member.id);
        const loanAmount = memberLoan ? 
          (memberLoan.principal_amount || 0) + ((memberLoan as any).interest_disbursed || 0) + ((memberLoan as any).processing_fee || 0) : 0;
        
        return {
          memberId: member.id,
          memberName: member.full_name,
          loanId: memberLoan?.id || '',
          loanAmount,
          paymentAmount: (totalAmount / memberIds.length).toFixed(2),
          isSelected: true
        };
      });
      
      setPaymentEntries(entries);
      
    } catch (error: any) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load member and loan data');
    } finally {
      setLoading(false);
    }
  };

  // Handle payment entry changes
  const handlePaymentAmountChange = (memberId: string, amount: string) => {
    setPaymentEntries(prev => 
      prev.map(entry => 
        entry.memberId === memberId 
          ? { ...entry, paymentAmount: amount }
          : entry
      )
    );
  };

  const handleEntrySelection = (memberId: string, selected: boolean) => {
    setPaymentEntries(prev => 
      prev.map(entry => 
        entry.memberId === memberId 
          ? { ...entry, isSelected: selected }
          : entry
      )
    );
  };

  // Handle select all
  const handleSelectAll = () => {
    const allSelected = paymentEntries.every(entry => entry.isSelected);
    setPaymentEntries(prev => 
      prev.map(entry => ({ ...entry, isSelected: !allSelected }))
    );
  };

  // Process bulk payment
  const handleBulkPayment = async () => {
    const selectedEntries = paymentEntries.filter(entry => entry.isSelected);
    
    if (selectedEntries.length === 0) {
      toast.error('Please select at least one member for payment');
      return;
    }
    
    setIsProcessing(true);
    try {
      // Process each payment
      const paymentPromises = selectedEntries.map(async (entry) => {
        if (!entry.loanId || parseFloat(entry.paymentAmount) <= 0) return;
        
        const amount = parseFloat(entry.paymentAmount);
        
        // Insert payment record
        const { error } = await supabase
          .from('loan_payments')
          .insert({
            loan_id: entry.loanId,
            amount: amount,
            payment_date: new Date().toISOString().split('T')[0],
            payment_reference: `BULK-${Date.now()}-${entry.memberId}`,
            notes: `Bulk payment: ${notes || 'Group payment'}`,
            created_by: user?.id
          });
        
        if (error) throw error;
        
        return { memberId: entry.memberId, amount, success: true };
      });
      
      const results = await Promise.all(paymentPromises);
      const successfulPayments = results.filter(r => r?.success);
      
      if (successfulPayments.length > 0) {
        toast.success(`Successfully processed ${successfulPayments.length} payment(s)`);
        
        // Navigate back to group details
        if (groupId) {
          navigate(`/groups/${groupId}`);
        } else {
          navigate('/groups');
        }
      }
      
    } catch (error: any) {
      console.error('Failed to process bulk payment:', error);
      toast.error('Failed to process bulk payment');
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper functions
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', { 
      style: 'currency', 
      currency: 'KES' 
    }).format(amount || 0);
  };

  const getTotalPaymentAmount = () => {
    return paymentEntries
      .filter(entry => entry.isSelected)
      .reduce((sum, entry) => sum + parseFloat(entry.paymentAmount || '0'), 0);
  };

  useEffect(() => {
    fetchData();
  }, [memberIds]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (memberIds.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Invalid Request</h2>
          <p className="text-muted-foreground">No members specified for bulk payment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bulk Payment</h1>
          <p className="text-muted-foreground">
            Record payments for {memberIds.length} group member(s)
          </p>
        </div>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Payment Summary
          </CardTitle>
          <CardDescription>
            Total amount to distribute: {formatCurrency(totalAmount)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{memberIds.length}</div>
              <div className="text-sm text-blue-600">Total Members</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {paymentEntries.filter(e => e.isSelected).length}
              </div>
              <div className="text-sm text-green-600">Selected Members</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(getTotalPaymentAmount())}
              </div>
              <div className="text-sm text-purple-600">Total Payment</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="mobile">Mobile Money</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Payment notes (optional)"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Entries */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payment Entries</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="flex items-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              {paymentEntries.every(e => e.isSelected) ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {paymentEntries.map((entry, index) => (
              <div key={entry.memberId} className="border rounded-lg p-4">
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={entry.isSelected}
                    onCheckedChange={(checked) => 
                      handleEntrySelection(entry.memberId, checked as boolean)
                    }
                  />
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{entry.memberName}</h4>
                        <p className="text-sm text-gray-600">
                          Loan Amount: {formatCurrency(entry.loanAmount)}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <Label htmlFor={`amount-${entry.memberId}`} className="text-sm">
                          Payment Amount
                        </Label>
                        <Input
                          id={`amount-${entry.memberId}`}
                          type="number"
                          value={entry.paymentAmount}
                          onChange={(e) => handlePaymentAmountChange(entry.memberId, e.target.value)}
                          className="w-32"
                          min="0"
                          step="0.01"
                          disabled={!entry.isSelected}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          disabled={isProcessing}
        >
          Cancel
        </Button>
        <Button
          onClick={handleBulkPayment}
          disabled={isProcessing || getTotalPaymentAmount() === 0}
          className="flex items-center gap-2"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CreditCard className="h-4 w-4" />
          )}
          Process Bulk Payment
        </Button>
      </div>
    </div>
  );
};

export default BulkPayment;

