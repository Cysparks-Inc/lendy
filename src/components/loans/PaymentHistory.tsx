import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';
import { ScrollableContainer } from '@/components/ui/scrollable-container'; // Assuming this component exists

// --- Type Definitions ---

// Defines the shape of the data we expect from the `payments_with_profile` view
interface Payment {
  id: number;
  loan_id: string; // UUID
  payment_date: string; // ISO string from Supabase
  amount: number;
  payment_method: string;
  notes: string | null;
  recorded_by_name: string | null;
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
          .from('payments_with_profile') // Using our efficient view
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
                    <TableHead>Recorded By</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium whitespace-nowrap">{formatDate(p.payment_date)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(p.amount)}</TableCell>
                      <TableCell><Badge variant="outline">{p.payment_method}</Badge></TableCell>
                      <TableCell>{p.recorded_by_name || 'N/A'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableContainer>
            <PaginationControls page={page} setPage={setPage} count={count} perPage={PAYMENTS_PER_PAGE} />
          </>
        )}
      </CardContent>
    </Card>
  );
};

// --- Pagination Sub-component with Typed Props ---

interface PaginationControlsProps {
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  count: number;
  perPage: number;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({ page, setPage, count, perPage }) => {
  const totalPages = Math.ceil(count / perPage);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-4">
      <div className="text-sm text-muted-foreground">
        Page {page + 1} of {totalPages}
      </div>
      <div className="flex items-center space-x-2">
        <Button variant="outline" size="icon" onClick={() => setPage(0)} disabled={page === 0}><ChevronsLeft className="h-4 w-4" /></Button>
        <Button variant="outline" size="icon" onClick={() => setPage(p => p - 1)} disabled={page === 0}><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="outline" size="icon" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="outline" size="icon" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}><ChevronsRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
};