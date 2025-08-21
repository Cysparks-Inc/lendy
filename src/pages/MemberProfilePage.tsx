import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowLeft, Loader2, Phone, Mail, MessageSquare, Briefcase, Home, Banknote, Users, DollarSign, Edit, Eye, UserCheck, PlusCircle, FileText, History } from 'lucide-react';
import { toast } from 'sonner';

// --- UI/UX FIX: Import the styled Tabs components from shadcn/ui ---
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Import DataTable for consistent table styling
import { DataTable } from '@/components/ui/data-table';

// Import the dialog components
import GenerateStatementDialog from '@/components/members/GenerateStatementDialog';
import { LogCommunicationDialog } from '@/components/members/LogCommunicationDialog';

// --- Type Definitions ---
interface NextOfKin { full_name: string; relationship: string; contact_number: string | null; }
interface MemberLoan { id: string; account_number: string; principal_amount: number; current_balance: number; status: 'active' | 'repaid' | 'defaulted' | 'pending'; due_date: string; }
interface CommunicationLog { id: number; created_at: string; communication_type: string; notes: string; officer_name: string | null; }
interface MemberProfileData {
  id: string;
  full_name: string;
  id_number: string;
  phone_number: string;
  branch_name: string;
  profession: string | null;
  house_type: string | null;
  profile_picture_url: string | null;
  assigned_officer_name: string | null;
  next_of_kin: NextOfKin[];
}

const MemberProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [member, setMember] = useState<MemberProfileData | null>(null);
  const [loans, setLoans] = useState<MemberLoan[]>([]);
  const [communicationLogs, setCommunicationLogs] = useState<CommunicationLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isStatementDialogOpen, setIsStatementDialogOpen] = useState(false);
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
        const [memberRes, loansRes, logsRes] = await Promise.all([
            supabase.from('members_with_details').select('*, next_of_kin(*)').eq('id', id).single(),
            supabase.from('loans_with_details').select('id, account_number, principal_amount, current_balance, status, due_date').eq('customer_id', id),
            supabase.from('communication_logs').select('*, officer:profiles(full_name)').eq('member_id', id).order('created_at', { ascending: false })
        ]);
        if (memberRes.error) throw memberRes.error;
        if (loansRes.error) throw loansRes.error;
        if (logsRes.error) throw logsRes.error;
        
        setMember(memberRes.data);
        setLoans(loansRes.data || []);
        setCommunicationLogs(logsRes.data.map(log => ({ ...log, officer_name: log.officer?.full_name })) || []);
    } catch (error: any) {
        toast.error('Failed to load member data', { description: error.message });
    } finally {
        setLoading(false);
    }
  };
  
  useEffect(() => { fetchData(); }, [id]);

  const onActionSuccess = () => fetchData();
  
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);
  const getStatusVariant = (status: MemberLoan['status']) => {
    switch (status) { case 'active': return 'default'; case 'repaid': return 'success'; case 'defaulted': return 'destructive'; case 'pending': return 'warning'; default: return 'secondary'; }
  };

  if (loading) { return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>; }
  if (!member) { return <div className="text-center p-10"><h2 className="text-xl font-semibold">Member Not Found</h2></div>; }
  
  const totalOutstanding = loans.reduce((sum, loan) => sum + (loan.current_balance || 0), 0);
  const cleanPhoneNumber = member.phone_number.replace(/[^0-9]/g, '');

  return (
    <>
        <div className="space-y-6 p-2 sm:p-4 md:p-6">
            {/* Modern Mobile-First Header */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-2">
                        <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                            <Link to="/members">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Members
                            </Link>
                        </Button>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{member.full_name}</h1>
                            <p className="text-muted-foreground text-sm sm:text-base">Member Profile & Financial History</p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Button onClick={() => setIsLogDialogOpen(true)} variant="secondary" className="w-full sm:w-auto">
                            <History className="mr-2 h-4 w-4" /> 
                            Log Activity
                        </Button>
                        <Button asChild className="w-full sm:w-auto">
                            <Link to={`/loans/new?memberId=${member.id}&memberName=${member.full_name}`}>
                                <PlusCircle className="mr-2 h-4 w-4" /> 
                                New Loan
                            </Link>
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full sm:w-auto">
                                    More Actions
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => setIsStatementDialogOpen(true)}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    <span>Generate Statement</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link to={`/members/${member.id}/edit`}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        <span>Edit Member</span>
                                    </Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>

            {/* Modern Responsive Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Profile Card - Full width on mobile, left column on desktop */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="overflow-hidden">
                        <CardHeader className="items-center text-center pb-6">
                            <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-secondary flex items-center justify-center mb-4 border-2 border-secondary/20">
                                {member.profile_picture_url ? (
                                    <img 
                                        key={member.profile_picture_url} 
                                        src={member.profile_picture_url} 
                                        alt={member.full_name} 
                                        className="h-full w-full rounded-full object-cover" 
                                    />
                                ) : (
                                    <span className="text-2xl sm:text-4xl font-bold text-primary">
                                        {member.full_name.charAt(0)}
                                    </span>
                                )}
                            </div>
                            <CardTitle className="text-lg sm:text-xl">{member.full_name}</CardTitle>
                            <CardDescription className="text-sm">ID: {member.id_number}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3">
                                <InfoItem icon={Phone} label="Phone Number" value={member.phone_number} />
                                <div className="flex flex-col sm:flex-row gap-2 pl-8 sm:pl-6">
                                    <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                                        <a href={`tel:${member.phone_number}`}>
                                            <Phone className="mr-2 h-4 w-4"/>
                                            Call
                                        </a>
                                    </Button>
                                    <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                                        <a href={`sms:${member.phone_number}`}>
                                            <MessageSquare className="mr-2 h-4 w-4"/>
                                            SMS
                                        </a>
                                    </Button>
                                    <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                                        <a href={`https://wa.me/${cleanPhoneNumber}`} target="_blank" rel="noopener noreferrer">
                                            <img src="/whatsapp-icon.svg" className="mr-2 h-4 w-4"/>
                                            WhatsApp
                                        </a>
                                    </Button>
                                </div>
                            </div>
                            <InfoItem icon={Briefcase} label="Profession" value={member.profession} />
                            <InfoItem icon={Home} label="Housing" value={member.house_type} />
                            <InfoItem icon={UserCheck} label="Assigned Officer" value={member.assigned_officer_name} />
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content - Full width on mobile, right columns on desktop */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Stats Cards - Responsive grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        <StatCard icon={Banknote} title="Active Loans" value={loans.length} />
                        <StatCard icon={DollarSign} title="Total Outstanding" value={formatCurrency(totalOutstanding)} />
                        <StatCard icon={Users} title="Branch" value={member.branch_name} />
                    </div>
                    
                    {/* Activity & History Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Activity & History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="loans" className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="loans">Loan History</TabsTrigger>
                                    <TabsTrigger value="communication">Communication History</TabsTrigger>
                                </TabsList>
                                <TabsContent value="loans" className="mt-6">
                                    <DataTable 
                                        columns={[
                                            { header: 'Account No.', cell: (row) => <span className="font-mono text-xs">{row.account_number}</span> },
                                            { header: 'Principal', cell: (row) => formatCurrency(row.principal_amount) },
                                            { header: 'Outstanding', cell: (row) => formatCurrency(row.current_balance) },
                                            { header: 'Status', cell: (row) => <Badge variant={getStatusVariant(row.status)} className="capitalize">{row.status}</Badge> },
                                            { header: 'Actions', cell: (row) => (
                                                <div className="text-right">
                                                    <Button asChild variant="outline" size="icon">
                                                        <Link to={`/loans/${row.id}`}>
                                                            <Eye className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                </div>
                                            ) }
                                        ]} 
                                        data={loans} 
                                        emptyStateMessage="No loan history for this member." 
                                    />
                                </TabsContent>
                                <TabsContent value="communication" className="mt-6">
                                    <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                                        {communicationLogs.length > 0 ? communicationLogs.map(log => (
                                            <div key={log.id} className="p-3 rounded-md border bg-muted/50">
                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                                                    <p className="font-semibold text-sm">{log.officer_name || 'System'} via {log.communication_type}</p>
                                                    <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                                                </div>
                                                <p className="text-sm">{log.notes}</p>
                                            </div>
                                        )) : <p className="text-center text-muted-foreground py-10">No communication has been logged.</p>}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>

        <GenerateStatementDialog open={isStatementDialogOpen} onOpenChange={setIsStatementDialogOpen} member={member} loans={loans} />
        <LogCommunicationDialog open={isLogDialogOpen} onOpenChange={setIsLogDialogOpen} member={member} onLogSuccess={onActionSuccess} />
    </>
  );
};

const InfoItem: React.FC<{icon: React.ElementType, label: string, value: string | null | undefined}> = ({icon: Icon, label, value}) => (
    <div className="space-y-1">
        <p className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Icon className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="truncate">{label}</span>
        </p>
        <p className="font-semibold text-sm sm:text-base text-foreground truncate">
            {value || 'N/A'}
        </p>
    </div>
);

const StatCard: React.FC<{title: string, value: string | number, icon: React.ElementType}> = ({ title, value, icon: Icon }) => (
    <Card className="border-brand-green-200 hover:border-brand-green-300 transition-colors">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-brand-green-600" />
        </CardHeader>
        <CardContent>
            <div className="text-lg sm:text-2xl font-bold text-brand-green-700">{value}</div>
        </CardContent>
    </Card>
);

export default MemberProfilePage;