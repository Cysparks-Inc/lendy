import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { ScrollableContainer } from '@/components/ui/scrollable-container';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';

// --- Type Definitions ---

// Defines the shape of a payment record
interface Payment {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

// Defines the shape of installment information
interface InstallmentInfo {
  installment_number: number;
  amount_applied: number;
  is_fully_paid: boolean;
}

// Defines the props for the PaymentHistory component
interface PaymentHistoryProps {
  loanId: string;
}

const PAYMENTS_PER_PAGE = 10;

// --- Main Component ---

export const PaymentHistory: React.FC<PaymentHistoryProps> = ({ loanId }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(0);
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    const fetchPayments = async () => {
      setLoading(true);
      const from = page * PAYMENTS_PER_PAGE;
      const to = from + PAYMENTS_PER_PAGE - 1;

      try {
        const { data, error, count } = await supabase
          .from('loan_payments')
          .select('*', { count: 'exact' })
          .eq('loan_id', loanId)
          .order('payment_date', { ascending: false })
          .range(from, to);

        if (error) throw error;

        setPayments(data as Payment[] || []);
        setCount(count || 0);
      } catch (error: any) {
        console.error("Failed to fetch payment history:", error.message);
        // Optionally, show a toast notification here
      } finally {
        setLoading(false);
      }
    };

    if (loanId) {
      fetchPayments();
    }
  }, [loanId, page]);

  const formatCurrency = (amount: number): string => 
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);

  const formatDate = (dateString: string): string => 
    new Date(dateString).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });

  // Function to get installment details for a payment
  const getInstallmentDetails = async (paymentId: string): Promise<InstallmentInfo[]> => {
    try {
      // This would need to be implemented based on how we track payment distribution
      // For now, we'll return a placeholder
      return [];
    } catch (error) {
      console.error('Failed to get installment details:', error);
      return [];
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Transaction History</CardTitle>
        <CardDescription>A complete log of all payments recorded for this loan.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-muted-foreground">No payments have been recorded yet.</p>
          </div>
        ) : (
          <>
            <ScrollableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Installments Affected</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium whitespace-nowrap">{formatDate(p.payment_date)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(p.amount)}</TableCell>
                      <TableCell><Badge variant="outline">{p.payment_method}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="text-xs">
                          <div className="font-medium">Payment Distribution</div>
                          <div className="text-muted-foreground">
                            Automatically applied to unpaid installments in order
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableContainer>
            {count > PAYMENTS_PER_PAGE && (
              <div className="mt-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setPage(Math.max(0, page - 1))}
                        className={page === 0 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <span className="px-4 py-2 text-sm text-muted-foreground">
                        Page {page + 1} of {Math.ceil(count / PAYMENTS_PER_PAGE)}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setPage(page + 1)}
                        className={page >= Math.ceil(count / PAYMENTS_PER_PAGE) - 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};