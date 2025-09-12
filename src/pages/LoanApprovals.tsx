import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Eye,
  Search,
  Filter,
  Calendar,
  DollarSign,
  User
} from 'lucide-react';
import { toast } from 'sonner';

interface PendingLoan {
  id: string;
  member_id: string;
  member_name: string;
  member_phone: string;
  group_name: string;
  principal_amount: number;
  interest_rate: number;
  payment_weeks: number;
  increment_level: number;
  purpose: string;
  notes: string;
  created_at: string;
  created_by: string;
  created_by_name: string;
}

const LoanApprovals: React.FC = () => {
  const { user, userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pendingLoans, setPendingLoans] = useState<PendingLoan[]>([]);
  const [allLoans, setAllLoans] = useState<PendingLoan[]>([]);
  const [filteredLoans, setFilteredLoans] = useState<PendingLoan[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLoan, setSelectedLoan] = useState<PendingLoan | null>(null);
  const [approvalDialog, setApprovalDialog] = useState(false);
  const [rejectionDialog, setRejectionDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    if (userRole === 'super_admin' || userRole === 'admin') {
      fetchPendingLoans();
      fetchAllLoans();
    }
  }, [userRole]);

  useEffect(() => {
    filterLoans();
  }, [pendingLoans, allLoans, searchTerm, activeTab]);

  const fetchPendingLoans = async () => {
    try {
      setLoading(true);
      
      // Fetch loans data separately to avoid relationship conflicts
      const { data: loansData, error: loansError } = await supabase
        .from('loans')
        .select('*')
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false });

      if (loansError) throw loansError;

      if (!loansData || loansData.length === 0) {
        setPendingLoans([]);
        return;
      }

      // Get unique member IDs and creator IDs
      const memberIds = [...new Set(loansData.map(loan => loan.member_id || loan.customer_id).filter(Boolean))];
      const creatorIds = [...new Set(loansData.map(loan => loan.created_by).filter(Boolean))];

      // Fetch members data
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('id, full_name, phone_number, group_id')
        .in('id', memberIds);

      if (membersError) throw membersError;

      // Fetch groups data
      const groupIds = membersData?.map(member => member.group_id).filter(Boolean) || [];
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('id, name')
        .in('id', groupIds);

      if (groupsError) throw groupsError;

      // Fetch creator profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', creatorIds);

      if (profilesError) throw profilesError;

      // Combine the data
      const formattedLoans = loansData.map(loan => {
        const memberId = loan.member_id || loan.customer_id;
        const member = membersData?.find(m => m.id === memberId);
        const group = groupsData?.find(g => g.id === member?.group_id);
        const creator = profilesData?.find(p => p.id === loan.created_by);

        return {
          id: loan.id,
          member_id: memberId,
          member_name: member?.full_name || 'Unknown',
          member_phone: member?.phone_number || 'N/A',
          group_name: group?.name || 'No Group',
          principal_amount: loan.principal_amount,
          interest_rate: loan.interest_rate,
          payment_weeks: loan.payment_weeks,
          increment_level: loan.increment_level,
          purpose: loan.purpose || '',
          notes: loan.notes || '',
          created_at: loan.created_at,
          created_by: loan.created_by,
          created_by_name: creator?.full_name || 'Unknown'
        };
      });

      setPendingLoans(formattedLoans);

    } catch (error: any) {
      toast.error('Failed to fetch pending loans', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchAllLoans = async () => {
    try {
      // Fetch all loans regardless of approval status
      const { data: loansData, error: loansError } = await supabase
        .from('loans')
        .select('*')
        .order('created_at', { ascending: false });

      if (loansError) throw loansError;

      if (!loansData || loansData.length === 0) {
        setAllLoans([]);
        return;
      }

      // Get unique member IDs and creator IDs
      const memberIds = [...new Set(loansData.map(loan => loan.member_id || loan.customer_id).filter(Boolean))];
      const creatorIds = [...new Set(loansData.map(loan => loan.created_by).filter(Boolean))];

      // Fetch members data
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('id, full_name, phone_number, group_id')
        .in('id', memberIds);

      if (membersError) throw membersError;

      // Fetch groups data
      const groupIds = membersData?.map(member => member.group_id).filter(Boolean) || [];
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('id, name')
        .in('id', groupIds);

      if (groupsError) throw groupsError;

      // Fetch creator profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', creatorIds);

      if (profilesError) throw profilesError;

      // Combine the data
      const formattedLoans = loansData.map(loan => {
        const memberId = loan.member_id || loan.customer_id;
        const member = membersData?.find(m => m.id === memberId);
        const group = groupsData?.find(g => g.id === member?.group_id);
        const creator = profilesData?.find(p => p.id === loan.created_by);

        return {
          id: loan.id,
          member_id: memberId,
          member_name: member?.full_name || 'Unknown',
          member_phone: member?.phone_number || 'N/A',
          group_name: group?.name || 'No Group',
          principal_amount: loan.principal_amount,
          interest_rate: loan.interest_rate,
          payment_weeks: loan.payment_weeks,
          increment_level: loan.increment_level,
          purpose: loan.purpose || '',
          notes: loan.notes || '',
          created_at: loan.created_at,
          created_by: loan.created_by,
          created_by_name: creator?.full_name || 'Unknown',
          approval_status: loan.approval_status || 'pending'
        };
      });

      setAllLoans(formattedLoans);

    } catch (error: any) {
      toast.error('Failed to fetch all loans', { description: error.message });
    }
  };

  const filterLoans = () => {
    let filtered = activeTab === 'pending' ? pendingLoans : allLoans;

    if (searchTerm) {
      filtered = filtered.filter(loan =>
        loan.member_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loan.member_phone.includes(searchTerm) ||
        loan.group_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredLoans(filtered);
  };

  const handleApprove = async (loanId: string) => {
    try {
      setSubmitting(true);

      // Use RPC to set status and post fee
      const { error } = await supabase.rpc('set_loan_approval_status', {
        p_loan_id: loanId,
        p_status: 'approved',
        p_set_by: user?.id
      });

      if (error) throw error;

      toast.success('Loan approved successfully');
      setApprovalDialog(false);
      setSelectedLoan(null);
      fetchPendingLoans();
      fetchAllLoans();

    } catch (error: any) {
      toast.error('Failed to approve loan', { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (loanId: string) => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase.rpc('set_loan_approval_status', {
        p_loan_id: loanId,
        p_status: 'rejected',
        p_set_by: user?.id
      });

      if (error) throw error;

      toast.success('Loan rejected');
      setRejectionDialog(false);
      setSelectedLoan(null);
      setRejectionReason('');
      fetchPendingLoans();
      fetchAllLoans();

    } catch (error: any) {
      toast.error('Failed to reject loan', { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
      approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (userRole !== 'super_admin' && userRole !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to view loan approvals</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Loan Approvals</h1>
          <p className="text-muted-foreground">
            Review and approve pending loan applications
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-3 py-1">
          {pendingLoans.length} Pending
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="pending">Pending Approvals</TabsTrigger>
          <TabsTrigger value="all">All Applications</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Loan Applications</CardTitle>
              <CardDescription>
                Review and approve loan applications from loan officers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by member name, phone, or group..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {filteredLoans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending loan applications
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Weeks</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLoans.map((loan) => (
                      <TableRow key={loan.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{loan.member_name}</div>
                            <div className="text-sm text-muted-foreground">{loan.member_phone}</div>
                          </div>
                        </TableCell>
                        <TableCell>{loan.group_name}</TableCell>
                        <TableCell className="font-medium">
                          KES {loan.principal_amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">Level {loan.increment_level}</Badge>
                        </TableCell>
                        <TableCell>{loan.payment_weeks} weeks</TableCell>
                        <TableCell>{loan.created_by_name}</TableCell>
                        <TableCell>
                          {new Date(loan.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedLoan(loan);
                                setApprovalDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedLoan(loan);
                                setApprovalDialog(true);
                              }}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedLoan(loan);
                                setRejectionDialog(true);
                              }}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Loan Applications</CardTitle>
              <CardDescription>
                View all loan applications including pending, approved, and rejected
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by member name, phone, or group..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {filteredLoans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No loan applications found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Weeks</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLoans.map((loan) => (
                      <TableRow key={loan.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{loan.member_name}</div>
                            <div className="text-sm text-muted-foreground">{loan.member_phone}</div>
                          </div>
                        </TableCell>
                        <TableCell>{loan.group_name}</TableCell>
                        <TableCell className="font-medium">
                          KES {loan.principal_amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">Level {loan.increment_level}</Badge>
                        </TableCell>
                        <TableCell>{loan.payment_weeks} weeks</TableCell>
                        <TableCell>
                          {getStatusBadge(loan.approval_status || 'pending')}
                        </TableCell>
                        <TableCell>{loan.created_by_name}</TableCell>
                        <TableCell>
                          {new Date(loan.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedLoan(loan);
                                setApprovalDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {loan.approval_status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedLoan(loan);
                                    setApprovalDialog(true);
                                  }}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setSelectedLoan(loan);
                                    setRejectionDialog(true);
                                  }}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Approval Dialog */}
      <Dialog open={approvalDialog} onOpenChange={setApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Loan Application</DialogTitle>
            <DialogDescription>
              Review the loan details before approving
            </DialogDescription>
          </DialogHeader>
          {selectedLoan && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Member</Label>
                  <p className="font-medium">{selectedLoan.member_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedLoan.member_phone}</p>
                </div>
                <div>
                  <Label>Group</Label>
                  <p className="font-medium">{selectedLoan.group_name}</p>
                </div>
                <div>
                  <Label>Amount</Label>
                  <p className="font-medium">KES {selectedLoan.principal_amount.toLocaleString()}</p>
                </div>
                <div>
                  <Label>Payment Period</Label>
                  <p className="font-medium">{selectedLoan.payment_weeks} weeks</p>
                </div>
                <div>
                  <Label>Increment Level</Label>
                  <p className="font-medium">Level {selectedLoan.increment_level}</p>
                </div>
                <div>
                  <Label>Interest Rate</Label>
                  <p className="font-medium">{selectedLoan.interest_rate}%</p>
                </div>
              </div>
              {selectedLoan.purpose && (
                <div>
                  <Label>Purpose</Label>
                  <p className="text-sm">{selectedLoan.purpose}</p>
                </div>
              )}
              {selectedLoan.notes && (
                <div>
                  <Label>Notes</Label>
                  <p className="text-sm">{selectedLoan.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApprovalDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleApprove(selectedLoan?.id || '')}
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve Loan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={rejectionDialog} onOpenChange={setRejectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Loan Application</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this loan application
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rejection_reason">Rejection Reason</Label>
              <Textarea
                id="rejection_reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectionDialog(false);
                setRejectionReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleReject(selectedLoan?.id || '')}
              disabled={submitting || !rejectionReason.trim()}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject Loan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoanApprovals;
