import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar, Download, DollarSign, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { generatePaymentReceipt, generateInstallmentSchedulePDF } from '@/utils/pdfGenerator';

interface InstallmentSchedule {
  installment_number: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  total_amount: number;
  status: 'pending' | 'paid' | 'overdue';
  paid_amount?: number;
  paid_date?: string;
  payment_reference?: string;
}

interface Loan {
  id: string;
  principal_amount: number;
  interest_disbursed: number;
  total_disbursed: number;
  issue_date: string;
  loan_program: string;
  installment_type: string;
  current_balance: number;
  total_paid: number;
  member_name?: string;
  loan_officer_name?: string;
  branch_name?: string;
  group_name?: string;
}

interface InstallmentScheduleTabProps {
  loan: Loan;
  onPaymentSuccess: (amount: number) => void;
}

export const InstallmentScheduleTab: React.FC<InstallmentScheduleTabProps> = ({ loan, onPaymentSuccess }) => {
  const [installments, setInstallments] = useState<InstallmentSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<InstallmentSchedule | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Generate installment schedule
  const generateInstallmentSchedule = () => {
    let repaymentWeeks: number;
    if (loan.loan_program === 'small_loan') {
      repaymentWeeks = 8;
    } else if (loan.loan_program === 'big_loan') {
      repaymentWeeks = 12;
    } else {
      repaymentWeeks = 8; // Default
    }

    const schedule: InstallmentSchedule[] = [];
    const issueDate = new Date(loan.issue_date);
    const weeklyPrincipal = Math.round((loan.principal_amount / repaymentWeeks) * 100) / 100;
    const weeklyInterest = Math.round((loan.interest_disbursed / repaymentWeeks) * 100) / 100;

    for (let i = 1; i <= repaymentWeeks; i++) {
      const dueDate = new Date(issueDate);
      dueDate.setDate(issueDate.getDate() + (i * 7));

      let installmentPrincipal = weeklyPrincipal;
      let installmentInterest = weeklyInterest;

      // Adjust last installment for rounding
      if (i === repaymentWeeks) {
        installmentPrincipal = Math.round((loan.principal_amount - (weeklyPrincipal * (repaymentWeeks - 1))) * 100) / 100;
        installmentInterest = Math.round((loan.interest_disbursed - (weeklyInterest * (repaymentWeeks - 1))) * 100) / 100;
      }

      const totalAmount = Math.round((installmentPrincipal + installmentInterest) * 100) / 100;
      
      // Determine status based on total paid vs what should be paid for this installment
      let status: 'pending' | 'paid' | 'overdue' = 'pending';
      const dueDateObj = new Date(dueDate);
      const today = new Date();
      
      // Calculate cumulative amount that should be paid by this installment
      const cumulativeAmountDue = totalAmount * i;
      
      if (loan.total_paid >= cumulativeAmountDue) {
        status = 'paid';
      } else if (dueDateObj < today && loan.total_paid < cumulativeAmountDue) {
        status = 'overdue';
      }

      schedule.push({
        installment_number: i,
        due_date: dueDate.toISOString().split('T')[0],
        principal_amount: installmentPrincipal,
        interest_amount: installmentInterest,
        total_amount: totalAmount,
        status
      });
    }

    setInstallments(schedule);
    setLoading(false);
  };

  useEffect(() => {
    generateInstallmentSchedule();
  }, [loan]);

  const handlePaymentClick = (installment: InstallmentSchedule) => {
    setSelectedInstallment(installment);
    setPaymentAmount(installment.total_amount.toString());
    setPaymentDialogOpen(true);
  };

  const handlePaymentSubmit = async () => {
    if (!selectedInstallment || !paymentAmount) return;

    const amount = Number(paymentAmount);
    if (amount <= 0) {
      toast.error('Payment amount must be greater than 0');
      return;
    }

    // Check if payment exceeds what's owed
    const totalOwed = selectedInstallment.total_amount;
    if (amount > totalOwed) {
      toast.error(`Payment amount cannot exceed KES ${totalOwed.toLocaleString()}`);
      return;
    }

    setRecordingPayment(true);
    try {
      // Record the payment
      const { error } = await supabase.from('loan_payments' as any).insert({
        loan_id: loan.id,
        amount: amount,
        payment_date: new Date().toISOString().split('T')[0],
        payment_reference: `PAY-${Date.now()}`,
        installment_number: selectedInstallment.installment_number,
        notes: `Payment for installment #${selectedInstallment.installment_number}`
      });

      if (error) throw error;

      toast.success('Payment recorded successfully!');
      setPaymentDialogOpen(false);
      onPaymentSuccess(amount);
      
      // Refresh the schedule
      generateInstallmentSchedule();
    } catch (error: any) {
      // Enhanced error logging to debug the total_paid column issue
      console.error('=== INSTALLMENT PAYMENT ERROR DETAILS ===');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      console.error('Error details:', error.details);
      console.error('Error hint:', error.hint);
      console.error('Full error:', JSON.stringify(error, null, 2));
      console.error('Loan object being used:', loan);
      console.error('=== END ERROR DETAILS ===');
      
      toast.error('Failed to record payment', { description: error.message });
    } finally {
      setRecordingPayment(false);
    }
  };

  const formatCurrency = (amount: number): string => 
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="default" className="bg-green-100 text-green-800">Paid</Badge>;
      case 'overdue':
        return <Badge variant="destructive">Overdue</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const downloadSchedulePDF = () => {
    const scheduleData = {
      loanAccount: loan.id,
      memberName: loan.member_name || 'Unknown Member',
      principalAmount: loan.principal_amount,
      interestAmount: loan.interest_disbursed,
      totalAmount: loan.total_disbursed,
      issueDate: loan.issue_date,
      loanProgram: loan.loan_program,
      installmentType: loan.installment_type,
      installments: installments.map(inst => ({
        number: inst.installment_number,
        dueDate: inst.due_date,
        principal: inst.principal_amount,
        interest: inst.interest_amount,
        total: inst.total_amount,
        status: inst.status
      }))
    };
    
    generateInstallmentSchedulePDF(scheduleData);
  };

  const generateReceipt = (installment: InstallmentSchedule) => {
    const receiptData = {
      paymentReference: `PAY-${Date.now()}`,
      memberName: loan.member_name || 'Unknown Member',
      loanAccount: loan.id,
      installmentNumber: installment.installment_number,
      amount: installment.total_amount,
      paymentDate: new Date().toISOString().split('T')[0],
      loanOfficer: loan.loan_officer_name || 'Unknown Officer',
      branch: loan.branch_name || 'Unknown Branch',
      group: loan.group_name || 'Unknown Group'
    };
    
    generatePaymentReceipt(receiptData);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Installment Schedule</h3>
          <p className="text-sm text-muted-foreground">
            {installments.length} weekly installments starting from {new Date(loan.issue_date).toLocaleDateString()}
          </p>
        </div>
        <Button onClick={downloadSchedulePDF} variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Download Schedule
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">#</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Interest</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installments.map((installment) => (
                  <TableRow key={installment.installment_number}>
                    <TableCell className="font-medium">
                      {installment.installment_number}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {new Date(installment.due_date).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(installment.principal_amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(installment.interest_amount)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(installment.total_amount)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(installment.status)}
                    </TableCell>
                    <TableCell className="text-center">
                      {installment.status === 'paid' ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="flex items-center text-green-600">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            <span className="text-xs">Paid</span>
                          </div>
                          <Button
                            onClick={() => generateReceipt(installment)}
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => handlePaymentClick(installment)}
                          size="sm"
                          variant="outline"
                          className="h-8 px-3"
                        >
                          <DollarSign className="h-3 w-3 mr-1" />
                          Pay
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record payment for installment #{selectedInstallment?.installment_number} due on {selectedInstallment?.due_date && new Date(selectedInstallment.due_date).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <Label className="text-sm text-gray-600">Installment Total</Label>
                <div className="font-semibold text-lg">
                  {formatCurrency(selectedInstallment?.total_amount || 0)}
                </div>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Due Date</Label>
                <div className="font-semibold">
                  {selectedInstallment?.due_date && new Date(selectedInstallment.due_date).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-amount">Payment Amount (KES)</Label>
              <Input
                id="payment-amount"
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Enter payment amount"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handlePaymentSubmit} 
              disabled={recordingPayment || !paymentAmount}
            >
              {recordingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Payment
            </Button>
            <Button 
              variant="outline" 
              onClick={() => selectedInstallment && generateReceipt(selectedInstallment)}
              disabled={!selectedInstallment}
            >
              <Download className="mr-2 h-4 w-4" />
              Generate Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
