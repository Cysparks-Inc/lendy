import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// --- Type Definitions ---

// Defines the shape of the loan object this component needs
interface LoanForPayment {
  id: string; // UUID
  status: string;
  current_balance: number;
  principal_amount: number;
  interest_disbursed?: number;
  total_disbursed?: number;
}

// Defines the props for this component
interface ManualPaymentEntryProps {
  loan: LoanForPayment;
  // The callback now expects the amount paid as an argument
  onPaymentSuccess: (paymentAmount: number) => void;
}

// --- Main Component ---

export const ManualPaymentEntry: React.FC<ManualPaymentEntryProps> = ({ loan, onPaymentSuccess }) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // --- Input Validation ---
    if (!amount || !paymentMethod) {
      setError('Amount and payment method are required.');
      return;
    }

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      setError('Please enter a valid, positive payment amount.');
      return;
    }

    const outstandingBalance = Math.max(0, ((loan.principal_amount || 0) + (loan.interest_disbursed || 0) + ((loan as any).processing_fee || 0)) - ((loan as any).total_paid || 0));
    if (paymentAmount > outstandingBalance) {
      setError(`Payment amount cannot exceed the outstanding balance of KES ${outstandingBalance.toLocaleString()}`);
      return;
    }
    
    // Additional validation: payment should not exceed the total loan amount
    const totalLoanAmount = loan.principal_amount + (loan.interest_disbursed || 0);
    if (paymentAmount > totalLoanAmount) {
      setError(`Payment amount cannot exceed the total loan amount of KES ${totalLoanAmount.toLocaleString()}`);
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Generate unique payment reference
      const paymentReference = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Insert payment record
      const { error: insertError } = await supabase
        .from('loan_payments' as any)
        .insert({
          loan_id: loan.id,
          installment_number: 0, // 0 indicates manual payment not tied to specific installment
          amount: paymentAmount,
          payment_date: new Date().toISOString().split('T')[0],
          payment_reference: paymentReference,
          notes: notes,
          created_by: user?.id,
        });

      if (insertError) throw insertError;

      // --- Success Handling ---
      // 1. Reset the form fields
      setAmount('');
      setPaymentMethod('cash');
      setNotes('');
      
      // 2. Call the parent's success handler and pass the amount for optimistic UI update
      if (onPaymentSuccess) {
        onPaymentSuccess(paymentAmount);
      }

      toast.success('Payment recorded successfully!');
      
    } catch (err: any) {
      // Enhanced error logging to debug the total_paid column issue
      console.error('=== PAYMENT ERROR DETAILS ===');
      console.error('Error object:', err);
      console.error('Error message:', err.message);
      console.error('Error code:', err.code);
      console.error('Error details:', err.details);
      console.error('Error hint:', err.hint);
      console.error('Full error:', JSON.stringify(err, null, 2));
      console.error('=== END ERROR DETAILS ===');
      
      const errorMessage = err.message || 'An unknown error occurred.';
      setError(errorMessage);
      toast.error('Failed to record payment', { description: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Conditionally render a message if the loan is already paid off
  // Check if the loan is actually fully paid by comparing total paid vs total amount due
  const totalAmountDue = (loan.principal_amount || 0) + (loan.interest_disbursed || 0) + ((loan as any).processing_fee || 0);
  const isFullyPaid = ((loan as any).total_paid || 0) >= totalAmountDue;
  
  if (loan.status === 'repaid' || isFullyPaid) {
    return (
      <Card className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
        <CardHeader>
          <CardTitle className="text-green-800 dark:text-green-300">Loan Repaid</CardTitle>
          <CardDescription className="text-green-700 dark:text-green-400">
            This loan has been fully paid off. No further payments can be recorded.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record Payment</CardTitle>
        <CardDescription>Log a new payment for this loan.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm text-blue-600 font-medium">Outstanding Balance</div>
            <div className="text-lg font-semibold text-blue-900">
              KES {Math.max(0, ((loan.principal_amount || 0) + (loan.interest_disbursed || 0) + ((loan as any).processing_fee || 0)) - ((loan as any).total_paid || 0)).toLocaleString()}
            </div>
          </div>
          
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-sm text-gray-600 font-medium">Loan Breakdown</div>
            <div className="text-xs text-gray-700 space-y-1 mt-1">
              <div>Principal: KES {(loan.principal_amount || 0).toLocaleString()}</div>
              <div>Interest: KES {(loan.interest_disbursed || 0).toLocaleString()}</div>
              <div>Processing Fee: KES {((loan as any).processing_fee || 0).toLocaleString()}</div>
              <div className="font-semibold border-t pt-1">Total Due: KES {((loan.principal_amount || 0) + (loan.interest_disbursed || 0) + ((loan as any).processing_fee || 0)).toLocaleString()}</div>
            </div>
          </div>
          
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-sm text-green-600 font-medium">Payment Distribution</div>
            <div className="text-xs text-green-700 mt-1">
              Your payment will be automatically distributed across unpaid installments in order of due date. 
              You can pay more than the installment amount - the excess will be applied to the next installments.
            </div>
          </div>

          <div>
            <Label htmlFor="amount">Amount (KES)</Label>
            <Input 
              id="amount" 
              type="number" 
              step="0.01"
              placeholder="e.g., 5000" 
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
              required 
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Maximum payment: KES {(loan.principal_amount + (loan.interest_disbursed || 0) + ((loan as any).processing_fee || 0)).toLocaleString()}
            </p>
          </div>
          <div>
            <Label htmlFor="payment_method">Payment Method</Label>
            <Select onValueChange={setPaymentMethod} value={paymentMethod} disabled={isSubmitting}>
              <SelectTrigger id="payment_method">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Input 
              id="notes" 
              placeholder="e.g., Paid at branch office" 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              disabled={isSubmitting}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record Payment
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};