import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Download, 
  Printer, 
  Eye, 
  Calendar, 
  DollarSign, 
  User, 
  Building,
  CreditCard,
  Banknote,
  Wallet,
  TrendingUp,
  TrendingDown,
  FileText,
  Receipt,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { InlineLoader, QuickLoader, PageLoader } from '@/components/ui/loader';
import { format } from 'date-fns';
import jsPDF from 'jspdf';

// Types
interface TransactionDetails {
  id: string;
  transaction_type: 'payment' | 'disbursement' | 'refund' | 'fee' | 'penalty' | 'adjustment';
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed' | 'cancelled';
  payment_method: 'cash' | 'bank_transfer' | 'mobile_money' | 'check' | 'other';
  reference_number: string;
  description: string;
  transaction_date: string;
  created_at: string;
  updated_at: string;
  
  // Related entities
  loan_id?: string;
  member_id?: string;
  loan_account_number?: string;
  member_name?: string;
  member_phone?: string;
  member_id_number?: string;
  branch_id?: number;
  branch_name?: string;
  branch_address?: string;
  loan_officer_id?: string;
  loan_officer_name?: string;
  loan_officer_phone?: string;
  
  // Additional details
  fees?: number;
  penalties?: number;
  principal_paid?: number;
  interest_paid?: number;
  total_paid?: number;
  balance_before?: number;
  balance_after?: number;
  
  // Metadata
  notes?: string;
  receipt_url?: string;
  created_by?: string;
  created_by_name?: string;
  
  // Loan details
  loan_principal?: number;
  loan_interest_rate?: number;
  loan_issue_date?: string;
  loan_due_date?: string;
  loan_status?: string;
}

const TransactionDetails: React.FC = () => {
  const { transactionId: paramTransactionId } = useParams<{ transactionId: string }>();
  const location = useLocation();
  const { user, userRole, profile } = useAuth();
  const navigate = useNavigate();
  
  // Get transaction ID from params or URL path
  const transactionId = paramTransactionId || location.pathname.split('/').pop();
  
  // Additional fallback: extract from URL if still not working
  const getTransactionIdFromUrl = () => {
    const pathSegments = location.pathname.split('/');
    const transactionsIndex = pathSegments.findIndex(segment => segment === 'transactions');
    if (transactionsIndex !== -1 && transactionsIndex + 1 < pathSegments.length) {
      return pathSegments[transactionsIndex + 1];
    }
    return null;
  };
  
  const finalTransactionId = transactionId || getTransactionIdFromUrl();
  
  // Early return if no transaction ID
  if (!finalTransactionId) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Invalid transaction URL</p>
        <Button onClick={() => navigate('/transactions')} className="mt-4">
          Back to Transactions
        </Button>
      </div>
    );
  }

  // State
  const [transaction, setTransaction] = useState<TransactionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  // Fetch transaction details
  const fetchTransactionDetails = useCallback(async () => {
    if (!finalTransactionId) {
      toast.error('Transaction ID is required');
      navigate('/transactions');
      return;
    }
    
    try {
      setLoading(true);
      
      // NOTE: Using loan_payments instead of transactions table
      // First fetch the payment record
      const { data: paymentData, error: paymentError } = await supabase
        .from('loan_payments')
        .select('*')
        .eq('id', finalTransactionId)
        .single();

      if (paymentError || !paymentData) {
        toast.error('Transaction not found');
        navigate('/transactions');
        return;
      }

      // Fetch related data separately
      // First get the loan to extract member_id and branch_id
      const loanData = paymentData.loan_id 
        ? await supabase.from('loans').select('id, application_no, principal_amount, interest_rate, issue_date, maturity_date, status, member_id, branch_id, loan_officer_id').eq('id', paymentData.loan_id).single()
        : { data: null, error: null };

      if (loanData.error) throw loanData.error;

      // Now fetch member and branch using IDs from the loan
      const [memberData, branchData] = await Promise.all([
        loanData.data?.member_id ? supabase.from('members').select('id, first_name, last_name, phone_number, id_number').eq('id', loanData.data.member_id).single() : { data: null, error: null },
        loanData.data?.branch_id ? supabase.from('branches').select('id, name').eq('id', loanData.data.branch_id).single() : { data: null, error: null }
      ]);

      const data = {
        ...paymentData,
        loans: loanData.data,
        members: memberData.data,
        branches: branchData.data
      };

      const error = paymentError || loanData.error || memberData.error || branchData.error;

      if (error) {
        // Check if it's a table not found error
        if (error.code === '42P01') {
          toast.error('Transactions table not found. Please run the database migration first.');
          navigate('/transactions');
          return;
        }
        
        toast.error('Failed to fetch transaction details');
        return;
      }

      if (!data) {
        // Check if we have any loan payments at all
        const { count } = await supabase
          .from('loan_payments')
          .select('*', { count: 'exact', head: true });
        
        if (count === 0) {
          toast.error('No transactions found in the system. Please record some payments first.');
          navigate('/transactions');
          return;
        }
        
        toast.error('Transaction not found');
        navigate('/transactions');
        return;
      }

      // Check access control
      if (userRole === 'branch_admin' && profile?.branch_id && data.branch_id !== profile.branch_id) {
        toast.error('Access denied. You can only view transactions from your branch.');
        navigate('/transactions');
        return;
      }

      if (userRole === 'loan_officer' && loanData.data?.loan_officer_id !== user?.id) {
        toast.error('Access denied. You can only view your own transactions.');
        navigate('/transactions');
        return;
      }

      // Concatenate member first_name and last_name
      const memberName = data.members?.first_name && data.members?.last_name
        ? `${data.members.first_name} ${data.members.last_name}`.trim()
        : data.members?.first_name || data.members?.last_name || 'Unknown Member';

      // Transform data to match our interface
      const transformedTransaction: TransactionDetails = {
        id: paymentData.id,
        transaction_type: paymentData.payment_type || 'payment',
        amount: paymentData.amount,
        currency: paymentData.currency || 'KES',
        status: paymentData.status || 'completed',
        payment_method: paymentData.payment_method || 'cash',
        reference_number: paymentData.reference_number || `LP-${paymentData.id.slice(0, 8)}`,
        description: paymentData.notes || 'Payment received',
        transaction_date: paymentData.payment_date || paymentData.created_at,
        created_at: paymentData.created_at,
        updated_at: paymentData.updated_at || paymentData.created_at,
        
        // Related entities
        loan_id: paymentData.loan_id || loanData.data?.id,
        member_id: loanData.data?.member_id || memberData.data?.id,
        loan_account_number: loanData.data?.application_no || 'N/A',
        member_name: memberName,
        member_phone: memberData.data?.phone_number,
        member_id_number: memberData.data?.id_number,
        branch_id: loanData.data?.branch_id,
        branch_name: branchData.data?.name,
        branch_address: branchData.data?.location || 'N/A',
        loan_officer_id: loanData.data?.loan_officer_id,
        loan_officer_name: 'Not specified', // We'll get this separately if needed
        loan_officer_phone: 'Not specified', // We'll get this separately if needed
        
        // Additional details
        fees: paymentData.processing_fee,
        penalties: paymentData.penalty_amount,
        principal_paid: paymentData.principal_amount,
        interest_paid: paymentData.interest_amount,
        total_paid: paymentData.total_amount,
        balance_before: paymentData.balance_before_payment,
        balance_after: paymentData.balance_after_payment,
        
        // Metadata
        notes: paymentData.notes,
        receipt_url: paymentData.receipt_file,
        created_by: paymentData.created_by,
        created_by_name: 'Not specified',
        
        // Loan details
        loan_principal: loanData.data?.principal_amount,
        loan_interest_rate: loanData.data?.interest_rate,
        loan_issue_date: loanData.data?.issue_date,
        loan_due_date: loanData.data?.maturity_date,
        loan_status: loanData.data?.status
      };

      setTransaction(transformedTransaction);

    } catch (error) {
      toast.error('Failed to fetch transaction details');
    } finally {
      setLoading(false);
    }
  }, [finalTransactionId, userRole, profile, navigate]);

  // Get transaction type info
  const getTransactionTypeInfo = (type: string) => {
    switch (type) {
      case 'payment':
        return { 
          icon: TrendingDown, 
          color: 'bg-green-100 text-green-800', 
          label: 'Payment',
          description: 'Member payment towards loan'
        };
      case 'disbursement':
        return { 
          icon: TrendingUp, 
          color: 'bg-blue-100 text-blue-800', 
          label: 'Disbursement',
          description: 'Loan amount disbursed to member'
        };
      case 'refund':
        return { 
          icon: TrendingUp, 
          color: 'bg-purple-100 text-purple-800', 
          label: 'Refund',
          description: 'Amount refunded to member'
        };
      case 'fee':
        return { 
          icon: CreditCard, 
          color: 'bg-orange-100 text-orange-800', 
          label: 'Fee',
          description: 'Administrative or processing fee'
        };
      case 'penalty':
        return { 
          icon: Banknote, 
          color: 'bg-red-100 text-red-800', 
          label: 'Penalty',
          description: 'Late payment or default penalty'
        };
      case 'adjustment':
        return { 
          icon: Wallet, 
          color: 'bg-gray-100 text-gray-800', 
          label: 'Adjustment',
          description: 'Balance or amount adjustment'
        };
      default:
        return { 
          icon: CreditCard, 
          color: 'bg-gray-100 text-gray-800', 
          label: type,
          description: 'Transaction'
        };
    }
  };

  // Get status info
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed':
        return { 
          icon: CheckCircle, 
          color: 'bg-green-100 text-green-800',
          description: 'Transaction successfully completed'
        };
      case 'pending':
        return { 
          icon: Clock, 
          color: 'bg-yellow-100 text-yellow-800',
          description: 'Transaction is being processed'
        };
      case 'failed':
        return { 
          icon: XCircle, 
          color: 'bg-red-100 text-red-800',
          description: 'Transaction failed to complete'
        };
      case 'cancelled':
        return { 
          icon: XCircle, 
          color: 'bg-gray-100 text-gray-800',
          description: 'Transaction was cancelled'
        };
      default:
        return { 
          icon: Info, 
          color: 'bg-gray-100 text-gray-800',
          description: 'Transaction status unknown'
        };
    }
  };

  // Get status variant for Badge component
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'failed':
        return 'destructive';
      case 'cancelled':
        return 'outline';
      default:
        return 'outline';
    }
  };

  // Get payment method label
  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash':
        return 'Cash';
      case 'bank_transfer':
        return 'Bank Transfer';
      case 'mobile_money':
        return 'Mobile Money';
      case 'check':
        return 'Check';
      case 'other':
        return 'Other';
      default:
        return method.charAt(0).toUpperCase() + method.slice(1);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString()}`;
  };

  // Print receipt
  const printReceipt = () => {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 100);
  };

  // Download receipt
  const downloadReceipt = () => {
    if (!transaction) {
      toast.error('No transaction data available');
      return;
    }

    try {
      // Create new PDF document
      const doc = new jsPDF();
      
      // Add company logo/header
      doc.setFontSize(24);
      doc.setTextColor(29, 78, 216); // Dark blue color
      doc.text('Lendy Microfinance', 105, 20, { align: 'center' });
      
      // Add subtitle
      doc.setFontSize(14);
      doc.setTextColor(107, 114, 128); // Gray color
      doc.text('Transaction Receipt', 105, 30, { align: 'center' });
      
      // Add separator line
      doc.setDrawColor(229, 231, 235);
      doc.line(20, 35, 190, 35);
      
      // Transaction details
      doc.setFontSize(12);
      doc.setTextColor(17, 24, 39); // Dark color
      
      // Reference and Date
      doc.text(`Reference: ${transaction.reference_number}`, 20, 50);
      doc.text(`Date: ${format(new Date(transaction.transaction_date), 'MMM dd, yyyy HH:mm')}`, 20, 60);
      
      // Transaction type and status
      doc.text(`Type: ${transaction.transaction_type.charAt(0).toUpperCase() + transaction.transaction_type.slice(1)}`, 20, 70);
      doc.text(`Status: ${transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}`, 20, 80);
      
      // Amount (highlighted)
      doc.setFontSize(18);
      doc.setTextColor(34, 197, 94); // Green color
      doc.text(`Amount: KES ${transaction.amount.toLocaleString()}`, 20, 95);
      
      // Payment method
      doc.setFontSize(12);
      doc.setTextColor(17, 24, 39);
      doc.text(`Payment Method: ${transaction.payment_method.replace('_', ' ').toUpperCase()}`, 20, 110);
      
      // Description
      doc.text(`Description: ${transaction.description}`, 20, 120);
      
      // Member information
      if (transaction.member_name) {
        doc.text(`Member: ${transaction.member_name}`, 20, 135);
        if (transaction.member_id_number) {
          doc.text(`ID: ${transaction.member_id_number}`, 20, 145);
        }
        if (transaction.member_phone) {
          doc.text(`Phone: ${transaction.member_phone}`, 20, 155);
        }
      }
      
      // Loan information
      if (transaction.loan_account_number) {
        doc.text(`Loan Account: ${transaction.loan_account_number}`, 20, 170);
      }
      
      // Branch information
      if (transaction.branch_name) {
        doc.text(`Branch: ${transaction.branch_name}`, 20, 185);
      }
      
      // Financial breakdown table
      if (transaction.principal_paid || transaction.interest_paid || transaction.fees || transaction.penalties) {
        doc.text('Payment Breakdown:', 20, 200);
        
        const breakdownData = [];
        if (transaction.principal_paid) breakdownData.push(['Principal Paid', `KES ${transaction.principal_paid.toLocaleString()}`]);
        if (transaction.interest_paid) breakdownData.push(['Interest Paid', `KES ${transaction.interest_paid.toLocaleString()}`]);
        if (transaction.fees) breakdownData.push(['Fees', `KES ${transaction.fees.toLocaleString()}`]);
        if (transaction.penalties) breakdownData.push(['Penalties', `KES ${transaction.penalties.toLocaleString()}`]);
        
        if (breakdownData.length > 0) {
          // Create table manually
          let yPos = 210;
          
          // Table header
          doc.setFillColor(34, 197, 94); // Green background
          doc.rect(20, yPos - 5, 170, 8, 'F');
          doc.setTextColor(255, 255, 255); // White text
          doc.text('Item', 25, yPos);
          doc.text('Amount', 140, yPos);
          
          yPos += 10;
          
          // Table rows
          doc.setTextColor(17, 24, 39); // Dark text
          breakdownData.forEach(([item, amount]) => {
            doc.text(item, 25, yPos);
            doc.text(amount, 140, yPos);
            yPos += 8;
          });
          
          // Add table border
          doc.setDrawColor(229, 231, 235); // Light gray border
          doc.setLineWidth(0.5);
          doc.rect(20, 205, 170, yPos - 205, 'S');
          
          // Reset text color
          doc.setTextColor(17, 24, 39);
        }
      }
      
      // Footer
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      doc.text('Generated by Lendy Microfinance System', 105, pageHeight - 20, { align: 'center' });
      doc.text(`Generated on: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, 105, pageHeight - 15, { align: 'center' });
      
      // Save the PDF
      doc.save(`receipt-${transaction.reference_number}-${format(new Date(transaction.transaction_date), 'yyyy-MM-dd')}.pdf`);
      
      toast.success('Receipt downloaded successfully');
    } catch (error) {
      toast.error('Failed to generate receipt');
    }
  };

  useEffect(() => {
    // Check if transactions table exists first
    const checkTableExists = async () => {
      try {
        const { error } = await supabase
          .from('loan_payments')
          .select('id')
          .limit(1);
        
        if (error) {
          if (error.code === '42P01') {
            toast.error('Transactions table not found. Please run the database migration first.');
            navigate('/transactions');
            return;
          }
        } else {
          // Fetch transaction details when component mounts
          if (finalTransactionId) {
            fetchTransactionDetails();
          }
        }
      } catch (err) {
        // Silent error handling
      }
    };
    
    checkTableExists();
    
    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
        toast.error('Transaction fetch timed out. Please try again.');
      }
    }, 10000); // 10 seconds timeout

    return () => clearTimeout(timeout);
  }, [finalTransactionId, fetchTransactionDetails]); // Include fetchTransactionDetails in dependencies

  if (loading) {
    return <PageLoader text="Loading transaction details..." />;
  }

  if (!transaction) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Transaction not found</p>
        <Button onClick={() => navigate('/transactions')} className="mt-4">
          Back to Transactions
        </Button>
      </div>
    );
  }

  const typeInfo = getTransactionTypeInfo(transaction.transaction_type);
  const statusInfo = getStatusInfo(transaction.status);
  const TypeIcon = typeInfo.icon;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-4 md:space-y-6 p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <Button variant="outline" onClick={() => navigate('/transactions')} className="flex-shrink-0">
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Back to Transactions</span>
            <span className="sm:hidden">Back</span>
          </Button>
          
          <div className="min-w-0 flex-1">
            <h1 className="text-heading-1 text-gray-900">Transaction Details</h1>
            <p className="text-body text-gray-600 mt-1 truncate">
              {transaction.reference_number} • {transaction.description}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={downloadReceipt} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Download Receipt</span>
            <span className="sm:hidden">Download</span>
          </Button>
          
          <Button variant="outline" onClick={printReceipt} disabled={printing} className="w-full sm:w-auto">
            {printing ? (
              <QuickLoader />
            ) : (
              <Printer className="mr-2 h-4 w-4" />
            )}
            <span className="hidden sm:inline">Print Receipt</span>
            <span className="sm:hidden">Print</span>
          </Button>
        </div>
      </div>

      {/* Transaction Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Main Transaction Info */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          {/* Transaction Header Card */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                  <div className={`p-2 md:p-3 rounded-full ${typeInfo.color} flex-shrink-0`}>
                    <TypeIcon className="h-6 w-6 md:h-8 md:w-8" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-heading-3">{typeInfo.label}</CardTitle>
                    <CardDescription className="text-body truncate">{typeInfo.description}</CardDescription>
                  </div>
                </div>
                
                <div className="text-center sm:text-right">
                  <div className="text-heading-1 text-gray-900">
                    KES {transaction.amount.toLocaleString()}
                  </div>
                  <div className="text-body text-gray-500">{transaction.currency}</div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="text-body font-medium text-gray-500">Reference Number</label>
                  <p className="text-body text-gray-900 font-mono truncate">{transaction.reference_number}</p>
                </div>
                <div>
                  <label className="text-body font-medium text-gray-500">Status</label>
                  <div className="flex items-center gap-2">
                    <StatusIcon className="h-4 w-4" />
                    <Badge variant={getStatusVariant(transaction.status)} className="text-caption">
                      {transaction.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-body font-medium text-gray-500">Payment Method</label>
                  <p className="text-body text-gray-900">{getPaymentMethodLabel(transaction.payment_method)}</p>
                </div>
                <div>
                  <label className="text-body font-medium text-gray-500">Transaction Date</label>
                  <p className="text-body text-gray-900">{format(new Date(transaction.transaction_date), 'PPP')}</p>
                </div>
              </div>
              
              {transaction.description && (
                <div>
                  <label className="text-body font-medium text-gray-500">Description</label>
                  <p className="text-body text-gray-900">{transaction.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Member and Loan Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-heading-3">Member & Loan Information</CardTitle>
              <CardDescription className="text-body text-muted-foreground">
                Details about the member and associated loan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-body font-medium text-gray-500">Member Name</label>
                  <p className="text-body text-gray-900">{transaction.member_name || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-body font-medium text-gray-500">Member ID</label>
                  <p className="text-body text-gray-900 font-mono">{transaction.member_id || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-body font-medium text-gray-500">Phone Number</label>
                  <p className="text-body text-gray-900">{transaction.member_phone || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-body font-medium text-gray-500">ID Number</label>
                  <p className="text-body text-gray-900">{transaction.member_id_number || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-body font-medium text-gray-500">Loan Account</label>
                  <p className="text-body text-gray-900 font-mono">{transaction.loan_account_number || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-body font-medium text-gray-500">Branch</label>
                  <p className="text-body text-gray-900">{transaction.branch_name || 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-heading-3">Financial Details</CardTitle>
              <CardDescription className="text-body text-muted-foreground">
                Breakdown of the transaction amount and balances
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-body font-medium text-gray-500">Principal Paid</label>
                  <p className="text-body text-gray-900">{formatCurrency(transaction.principal_paid || 0)}</p>
                </div>
                <div>
                  <label className="text-body font-medium text-gray-500">Interest Paid</label>
                  <p className="text-body text-gray-900">{formatCurrency(transaction.interest_paid || 0)}</p>
                </div>
                <div>
                  <label className="text-body font-medium text-gray-500">Fees</label>
                  <p className="text-body text-gray-900">{formatCurrency(transaction.fees || 0)}</p>
                </div>
                <div>
                  <label className="text-body font-medium text-gray-500">Penalties</label>
                  <p className="text-body text-gray-900">{formatCurrency(transaction.penalties || 0)}</p>
                </div>
                <div>
                  <label className="text-body font-medium text-gray-500">Balance Before</label>
                  <p className="text-body text-gray-900">{formatCurrency(transaction.balance_before || 0)}</p>
                </div>
                <div>
                  <label className="text-body font-medium text-gray-500">Balance After</label>
                  <p className="text-body text-gray-900">{formatCurrency(transaction.balance_after || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Related Loan Information */}
          {transaction.loan_id && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CreditCard className="h-5 w-5" />
                  Related Loan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Loan Account</label>
                    <p className="text-sm text-gray-900 font-mono truncate">{transaction.loan_account_number}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Loan Status</label>
                    <Badge variant="outline">{transaction.loan_status}</Badge>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Principal Amount</label>
                    <p className="text-sm text-gray-900">
                      KES {transaction.loan_principal?.toLocaleString() || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Interest Rate</label>
                    <p className="text-sm text-gray-900">
                      {transaction.loan_interest_rate || 'N/A'}%
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Issue Date</label>
                    <p className="text-sm text-gray-900">
                      {transaction.loan_issue_date ? format(new Date(transaction.loan_issue_date), 'MMM dd, yyyy') : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Due Date</label>
                    <p className="text-sm text-gray-900">
                      {transaction.loan_due_date ? format(new Date(transaction.loan_due_date), 'MMM dd, yyyy') : 'N/A'}
                    </p>
                  </div>
                </div>
                
                <div className="mt-4">
                  <Link 
                    to={`/loans/${transaction.loan_id}`}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    View Loan Details →
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {transaction.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-900">{transaction.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Sidebar - Transaction Summary */}
        <div className="space-y-4 md:space-y-6">
          {/* Transaction Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-heading-3">Transaction Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-body text-gray-600">Transaction ID</span>
                <span className="text-body font-mono text-gray-900">{transaction.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-body text-gray-600">Created</span>
                <span className="text-body text-gray-900">{format(new Date(transaction.created_at), 'PPp')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-body text-gray-600">Updated</span>
                <span className="text-body text-gray-900">{format(new Date(transaction.updated_at), 'PPp')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-body text-gray-600">Created By</span>
                <span className="text-body text-gray-900">{transaction.created_by_name || 'System'}</span>
              </div>
            </CardContent>
          </Card>

          {/* Loan Officer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-heading-3">Loan Officer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-body font-medium text-gray-900">{transaction.loan_officer_name || 'Unassigned'}</p>
                  <p className="text-caption text-gray-500">{transaction.loan_officer_phone || 'No phone'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Branch Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-heading-3">Branch</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <Building className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-body font-medium text-gray-900">{transaction.branch_name || 'Unknown Branch'}</p>
                  <p className="text-caption text-gray-500">{transaction.branch_address || 'No address'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {transaction.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-heading-3">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-body text-gray-700">{transaction.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionDetails;
