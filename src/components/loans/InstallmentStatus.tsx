import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface Installment {
  id: string;
  installment_number: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  total_amount: number;
  amount_paid: number;
  is_paid: boolean;
  paid_date: string | null;
}

interface InstallmentStatusProps {
  loanId: string;
}

export const InstallmentStatus: React.FC<InstallmentStatusProps> = ({ loanId }) => {
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInstallments = async () => {
      try {
        const { data, error } = await supabase
          .from('loan_installments')
          .select('*')
          .eq('loan_id', loanId)
          .order('installment_number');

        if (error) throw error;
        setInstallments(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInstallments();
  }, [loanId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Installment Status</CardTitle>
          <CardDescription>Loading installment information...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Installment Status</CardTitle>
          <CardDescription>Error loading installments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-red-600 text-sm">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (installments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Installment Status</CardTitle>
          <CardDescription>No installments found for this loan</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusIcon = (installment: Installment) => {
    if (installment.is_paid) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    
    const dueDate = new Date(installment.due_date);
    const today = new Date();
    
    if (dueDate < today) {
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    }
    
    return <Clock className="h-4 w-4 text-yellow-600" />;
  };

  const getStatusBadge = (installment: Installment) => {
    if (installment.is_paid) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Paid</Badge>;
    }
    
    const dueDate = new Date(installment.due_date);
    const today = new Date();
    
    if (dueDate < today) {
      return <Badge variant="destructive">Overdue</Badge>;
    }
    
    if (installment.amount_paid > 0) {
      return <Badge variant="secondary">Partial</Badge>;
    }
    
    return <Badge variant="outline">Pending</Badge>;
  };

  const getProgressPercentage = (installment: Installment) => {
    return Math.min((installment.amount_paid / installment.total_amount) * 100, 100);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Installment Status</CardTitle>
        <CardDescription>
          Track the payment status of each installment
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {installments.map((installment) => (
            <div key={installment.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getStatusIcon(installment)}
                  <span className="font-medium">
                    Installment {installment.installment_number}
                  </span>
                  {getStatusBadge(installment)}
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Due: {formatDate(installment.due_date)}</div>
                  {installment.paid_date && (
                    <div className="text-xs text-green-600">Paid: {formatDate(installment.paid_date)}</div>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                <div>
                  <div className="text-muted-foreground">Principal</div>
                  <div className="font-medium">KES {installment.principal_amount.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Interest</div>
                  <div className="font-medium">KES {installment.interest_amount.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total</div>
                  <div className="font-medium">KES {installment.total_amount.toLocaleString()}</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Amount Paid</span>
                  <span className="font-medium">
                    KES {installment.amount_paid.toLocaleString()}
                  </span>
                </div>
                
                {installment.amount_paid > 0 && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getProgressPercentage(installment)}%` }}
                    />
                  </div>
                )}
                
                {installment.amount_paid < installment.total_amount && (
                  <div className="text-sm text-muted-foreground">
                    Remaining: KES {(installment.total_amount - installment.amount_paid).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-blue-600 font-medium mb-2">How Payments Work</div>
          <div className="text-xs text-blue-700 space-y-1">
            <div>• Payments are automatically distributed across unpaid installments</div>
            <div>• You can pay more than the installment amount - excess goes to next installments</div>
            <div>• Installments are marked as paid when fully covered</div>
            <div>• Partial payments are tracked and applied to the next installment</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
