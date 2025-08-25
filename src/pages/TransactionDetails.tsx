import React, { useState, useEffect } from 'react';
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
import { PageLoader, InlineLoader } from '@/components/ui/loader';
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
    console.error('No transaction ID available');
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
  const fetchTransactionDetails = async () => {
    if (!finalTransactionId) {
      console.error('No transaction ID provided');
      toast.error('Transaction ID is required');
      navigate('/transactions');
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          loans!loan_id(
            id,
            account_number,
            principal_amount,
            interest_rate,
            issue_date,
            due_date,
            status,
            member_id,
            loan_officer_id
          ),
          members!member_id(
            id,
            full_name,
            phone_number,
            id_number
          ),
          branches!branch_id(
            id,
            name,
            address
          )
        `)
        .eq('id', finalTransactionId)
        .single();

      if (error) {
        console.error('Error fetching transaction:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        toast.error('Failed to fetch transaction details');
        return;
      }

      if (!data) {
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

      if (userRole === 'loan_officer' && data.loans?.loan_officer_id !== user?.id) {
        toast.error('Access denied. You can only view your own transactions.');
        navigate('/transactions');
        return;
      }

      // Transform data to match our interface
      const transformedTransaction: TransactionDetails = {
        id: data.id,
        transaction_type: data.transaction_type,
        amount: data.amount,
        currency: data.currency || 'KES',
        status: data.status,
        payment_method: data.payment_method,
        reference_number: data.reference_number,
        description: data.description,
        transaction_date: data.transaction_date,
        created_at: data.created_at,
        updated_at: data.updated_at,
        
        // Related entities
        loan_id: data.loans?.id,
        member_id: data.members?.id,
        loan_account_number: data.loans?.account_number,
        member_name: data.members?.full_name,
        member_phone: data.members?.phone_number,
        member_id_number: data.members?.id_number,
        branch_id: data.branch_id,
        branch_name: data.branches?.name,
        branch_address: data.branches?.address,
        loan_officer_id: data.loans?.loan_officer_id,
        loan_officer_name: 'Not specified', // We'll get this separately if needed
        loan_officer_phone: 'Not specified', // We'll get this separately if needed
        
        // Additional details
        fees: data.fees,
        penalties: data.penalties,
        principal_paid: data.principal_paid,
        interest_paid: data.interest_paid,
        total_paid: data.total_paid,
        balance_before: data.balance_before,
        balance_after: data.balance_after,
        
        // Metadata
        notes: data.notes,
        receipt_url: data.receipt_url,
        created_by: data.created_by,
        created_by_name: data.created_by_name,
        
        // Loan details
        loan_principal: data.loans?.principal_amount,
        loan_interest_rate: data.loans?.interest_rate,
        loan_issue_date: data.loans?.issue_date,
        loan_due_date: data.loans?.due_date,
        loan_status: data.loans?.status
      };

      setTransaction(transformedTransaction);

    } catch (error) {
      console.error('Error fetching transaction details:', error);
      toast.error('Failed to fetch transaction details');
    } finally {
      setLoading(false);
    }
  };

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
      doc.setTextColor(34, 197, 94); // Green color
      doc.text('Napol Microfinance', 105, 20, { align: 'center' });
      
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
      doc.text('Generated by Napol Microfinance System', 105, pageHeight - 20, { align: 'center' });
      doc.text(`Generated on: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, 105, pageHeight - 15, { align: 'center' });
      
      // Save the PDF
      doc.save(`receipt-${transaction.reference_number}-${format(new Date(transaction.transaction_date), 'yyyy-MM-dd')}.pdf`);
      
      toast.success('Receipt downloaded successfully');
    } catch (error) {
      console.error('Error generating receipt:', error);
      toast.error('Failed to generate receipt');
    }
  };

  useEffect(() => {
    // Only fetch if we have a transaction ID and we're not already loading
    if (finalTransactionId && !loading) {
      fetchTransactionDetails();
    }
    
    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (loading) {
        console.error('Transaction fetch timeout');
        setLoading(false);
        toast.error('Transaction fetch timed out. Please try again.');
      }
    }, 10000); // 10 seconds timeout

    return () => clearTimeout(timeout);
  }, [finalTransactionId]); // Remove loading from dependencies to prevent loops

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/transactions')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Transactions
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Transaction Details</h1>
            <p className="text-gray-600 mt-1">
              {transaction.reference_number} • {transaction.description}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadReceipt}>
            <Download className="mr-2 h-4 w-4" />
            Download Receipt
          </Button>
          
          <Button variant="outline" onClick={printReceipt} disabled={printing}>
            {printing ? (
              <InlineLoader size="sm" variant="primary" />
            ) : (
              <Printer className="mr-2 h-4 w-4" />
            )}
            Print Receipt
          </Button>
        </div>
      </div>

      {/* Transaction Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Transaction Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Transaction Header Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${typeInfo.color}`}>
                    <TypeIcon className="h-8 w-8" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{typeInfo.label}</CardTitle>
                    <CardDescription>{typeInfo.description}</CardDescription>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">
                    KES {transaction.amount.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">{transaction.currency}</div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Reference Number</label>
                  <p className="text-sm text-gray-900 font-mono">{transaction.reference_number}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`p-1 rounded-full ${statusInfo.color}`}>
                      <StatusIcon className="h-4 w-4" />
                    </div>
                    <Badge className={statusInfo.color}>
                      {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Payment Method</label>
                  <p className="text-sm text-gray-900">
                    {transaction.payment_method.replace('_', ' ').toUpperCase()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Transaction Date</label>
                  <p className="text-sm text-gray-900">
                    {format(new Date(transaction.transaction_date), 'MMM dd, yyyy HH:mm')}
                  </p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Description</label>
                <p className="text-sm text-gray-900 mt-1">{transaction.description}</p>
              </div>
            </CardContent>
          </Card>

          {/* Financial Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Financial Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900">Payment Breakdown</h4>
                  <div className="space-y-3">
                    {transaction.principal_paid && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Principal Paid</span>
                        <span className="text-sm font-medium">KES {transaction.principal_paid.toLocaleString()}</span>
                      </div>
                    )}
                    {transaction.interest_paid && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Interest Paid</span>
                        <span className="text-sm font-medium">KES {transaction.interest_paid.toLocaleString()}</span>
                      </div>
                    )}
                    {transaction.fees && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Fees</span>
                        <span className="text-sm font-medium">KES {transaction.fees.toLocaleString()}</span>
                      </div>
                    )}
                    {transaction.penalties && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Penalties</span>
                        <span className="text-sm font-medium">KES {transaction.penalties.toLocaleString()}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Total Amount</span>
                      <span>KES {transaction.amount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900">Balance Impact</h4>
                  <div className="space-y-3">
                    {transaction.balance_before && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Balance Before</span>
                        <span className="text-sm font-medium">KES {transaction.balance_before.toLocaleString()}</span>
                      </div>
                    )}
                    {transaction.balance_after && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Balance After</span>
                        <span className="text-sm font-medium">KES {transaction.balance_after.toLocaleString()}</span>
                      </div>
                    )}
                    {transaction.balance_before && transaction.balance_after && (
                      <>
                        <Separator />
                        <div className="flex justify-between font-semibold">
                          <span>Change</span>
                          <span className={transaction.balance_after < transaction.balance_before ? 'text-green-600' : 'text-red-600'}>
                            KES {(transaction.balance_after - transaction.balance_before).toLocaleString()}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Related Loan Information */}
          {transaction.loan_id && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Related Loan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Loan Account</label>
                    <p className="text-sm text-gray-900 font-mono">{transaction.loan_account_number}</p>
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
                <CardTitle className="flex items-center gap-2">
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

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Member Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Member Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Name</label>
                <p className="text-sm text-gray-900">{transaction.member_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">ID Number</label>
                <p className="text-sm text-gray-900">{transaction.member_id_number}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Phone</label>
                <p className="text-sm text-gray-900">{transaction.member_phone}</p>
              </div>
              
              <div className="pt-2">
                <Link 
                  to={`/members/${transaction.member_id}`}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  View Member Profile →
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Branch Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Branch Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Branch Name</label>
                <p className="text-sm text-gray-900">{transaction.branch_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Address</label>
                <p className="text-sm text-gray-900">{transaction.branch_address}</p>
              </div>
            </CardContent>
          </Card>

          {/* Loan Officer */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Loan Officer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Name</label>
                <p className="text-sm text-gray-900">{transaction.loan_officer_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Phone</label>
                <p className="text-sm text-gray-900">{transaction.loan_officer_phone}</p>
              </div>
            </CardContent>
          </Card>

          {/* Transaction Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Transaction Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Created By</label>
                <p className="text-sm text-gray-900">{transaction.created_by_name || 'System'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Created At</label>
                <p className="text-sm text-gray-900">
                  {format(new Date(transaction.created_at), 'MMM dd, yyyy HH:mm')}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Last Updated</label>
                <p className="text-sm text-gray-900">
                  {format(new Date(transaction.updated_at), 'MMM dd, yyyy HH:mm')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TransactionDetails;
