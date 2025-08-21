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
  status: 'pending' | 'active' | 'repaid' | 'defaulted';
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
  const [paymentMethod, setPaymentMethod] = useState<string>('');
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
    
    // --- Data Preparation ---
    // For now, we assume the full amount is allocated to the principal.
    // This can be enhanced later with more complex principal/interest allocation logic if needed.
    const principalComponent = paymentAmount;
    const interestComponent = 0;

    setIsSubmitting(true);
    try {
      const { error: insertError } = await supabase
        .from('payments')
        .insert({
          loan_id: loan.id,
          recorded_by: user?.id, // Ensure user context provides the id
          amount: paymentAmount,
          principal_component: principalComponent,
          interest_component: interestComponent,
          payment_method: paymentMethod,
          notes: notes,
        });

      if (insertError) throw insertError;

      // --- Success Handling ---
      // 1. Reset the form fields
      setAmount('');
      setPaymentMethod('');
      setNotes('');
      
      // 2. Call the parent's success handler and pass the amount for optimistic UI update
      if (onPaymentSuccess) {
        onPaymentSuccess(paymentAmount);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'An unknown error occurred.';
      setError(errorMessage);
      toast.error('Failed to record payment', { description: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Conditionally render a message if the loan is already paid off
  if (loan.status === 'repaid') {
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
          <div>
            <Label htmlFor="amount">Amount (KES)</Label>
            <Input 
              id="amount" 
              type="number" 
              placeholder="e.g., 5000" 
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
              required 
              disabled={isSubmitting}
            />
          </div>
          <div>
            <Label htmlFor="payment_method">Payment Method</Label>
            <Select onValueChange={setPaymentMethod} value={paymentMethod} disabled={isSubmitting}>
              <SelectTrigger id="payment_method">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                <SelectItem value="Bank Deposit">Bank Deposit</SelectItem>
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