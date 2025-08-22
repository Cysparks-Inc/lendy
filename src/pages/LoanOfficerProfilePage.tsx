import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Mail, Phone, MapPin, Banknote, Users, TrendingUp, DollarSign, Eye, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table'; // Reusable component
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// --- Type Definitions ---
interface OfficerProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  branch_name: string;
  profile_picture_url: string | null;
  total_loans: number;
  total_disbursed: number;
  total_balance: number;
}

interface OfficerLoan {
  id: string; // Loan ID
  customer_id: string; // Member ID
  account_number: string;
  member_name: string;
  principal_amount: number;
  current_balance: number;
  status: 'active' | 'repaid' | 'defaulted' | 'pending';
  due_date: string;
}

interface OfficerMember {
    id: string;
    full_name: string;
    phone_number: string;
    total_loans: number;
    outstanding_balance: number;
}


const LoanOfficerProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [officer, setOfficer] = useState<OfficerProfile | null>(null);
  const [loans, setLoans] = useState<OfficerLoan[]>([]);
  const [members, setMembers] = useState<OfficerMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchOfficerData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const [profileRes, loansRes, membersRes] = await Promise.all([
          supabase.rpc('get_officer_performance_data', { requesting_user_id: id }).single(),
          supabase.from('loans_with_details').select('id, customer_id, account_number, member_name, principal_amount, current_balance, status, due_date').eq('loan_officer_id', id),
          supabase.rpc('get_members_by_officer', { officer_id: id })
        ]);

        if (profileRes.error) throw profileRes.error;
        if (loansRes.error) throw loansRes.error;
        if (membersRes.error) throw membersRes.error;

        setOfficer(profileRes.data as OfficerProfile);
        setLoans(loansRes.data as OfficerLoan[]);
        setMembers(membersRes.data as OfficerMember[]);

      } catch (error: any) {
        toast.error('Failed to load officer data', { description: error.message });
      } finally {
        setLoading(false);
      }
    };

    fetchOfficerData();
  }, [id]);

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);
  const getStatusVariant = (status: OfficerLoan['status']) => {
    switch (status) { case 'active': return 'default'; case 'repaid': return 'success'; case 'defaulted': return 'destructive'; case 'pending': return 'warning'; default: return 'secondary'; }
  };

  const loanColumns = [
    { header: 'Account No.', cell: (row: OfficerLoan) => <Link to={`/loans/${row.id}`} className="font-mono text-xs text-primary hover:underline">{row.account_number}</Link> },
    { header: 'Member', cell: (row: OfficerLoan) => <Link to={`/members/${row.customer_id}`} className="hover:underline">{row.member_name}</Link> },
    { header: 'Principal', cell: (row: OfficerLoan) => formatCurrency(row.principal_amount) },
    { header: 'Outstanding', cell: (row: OfficerLoan) => formatCurrency(row.current_balance) },
    { header: 'Status', cell: (row: OfficerLoan) => <Badge variant={getStatusVariant(row.status)} className="capitalize">{row.status}</Badge> },
    { header: 'Actions', cell: (row: OfficerLoan) => <div className="text-right"><Button asChild variant="outline" size="icon"><Link to={`/loans/${row.id}`}><Eye className="h-4 w-4" /></Link></Button></div> },
  ];

  const memberColumns = [
    { header: 'Name', cell: (row: OfficerMember) => <Link to={`/members/${row.id}`} className="font-medium hover:underline">{row.full_name}</Link> },
    { header: 'Phone', cell: (row: OfficerMember) => row.phone_number },
    { header: 'Total Loans', cell: (row: OfficerMember) => row.total_loans },
    { header: 'Outstanding', cell: (row: OfficerMember) => formatCurrency(row.outstanding_balance) },
  ];
  
  if (loading) { return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>; }
  if (!officer) { return <div className="text-center p-10"><h2 className="text-xl font-semibold">Loan Officer Not Found</h2></div>; }

  const getInitials = (name: string) => {
    const names = name.split(' ');
    if (names.length === 1) return names[0].charAt(0);
    return names[0].charAt(0) + names[names.length - 1].charAt(0);
  };

  return (
    <div className="space-y-6 p-2 sm:p-4 md:p-6">
      {/* Modern Mobile-First Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
              <Link to="/loan-officer">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Officer List
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{officer.name}</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Performance and portfolio overview</p>
            </div>
          </div>
          <Button asChild className="w-full sm:w-auto">
            <Link to={`/users/${officer.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Profile
            </Link>
          </Button>
        </div>
      </div>
      
      {/* Modern Profile Card with Better Mobile Layout */}
      {/* Profile Card */}
      <Card className="overflow-hidden bg-gradient-to-br from-brand-green-50 to-brand-green-100 border-brand-green-200 hover:border-brand-green-300 transition-all duration-200 hover:shadow-md">
        <CardHeader className="pb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="relative">
              <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-2 border-brand-green-200">
                <AvatarImage src={officer.profile_picture_url} alt={officer.name} />
                <AvatarFallback className="bg-brand-green-100 text-brand-green-700 text-lg">
                  {getInitials(officer.name)}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="text-center sm:text-left">
              <CardTitle className="text-2xl sm:text-3xl text-brand-green-800 mb-2">{officer.name}</CardTitle>
              <CardDescription className="text-brand-green-600">{officer.email}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      {/* Tabs Section */}
      <Tabs defaultValue="loans" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="loans">Loan Portfolio ({loans.length})</TabsTrigger>
          <TabsTrigger value="members">Member Portfolio ({members.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="loans" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Loan Portfolio</CardTitle>
              <CardDescription>All loans managed by {officer.name}.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable columns={loanColumns} data={loans} emptyStateMessage="This officer has not managed any loans yet." />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="members" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Member Portfolio</CardTitle>
              <CardDescription>All members assigned to {officer.name}.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable columns={memberColumns} data={members} emptyStateMessage="This officer is not assigned to any members." />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const InfoItem: React.FC<{icon: React.ElementType, label: string, value: string | number | null | undefined}> = ({icon: Icon, label, value}) => (
    <div className="space-y-1">
        <p className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Icon className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="truncate">{label}</span>
        </p>
        <p className="font-semibold text-sm sm:text-lg text-foreground truncate">
            {value || 'N/A'}
        </p>
    </div>
);

export default LoanOfficerProfilePage;