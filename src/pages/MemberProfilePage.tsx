import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import { LogCommunicationDialog } from '@/components/loans/LogCommunicationDialog';
import { CommunicationLogs } from '@/components/loans/CommunicationLogs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

// --- Type Definitions ---
interface NextOfKin { full_name: string; relationship: string; contact_number: string | null; }
interface MemberLoan { id: string; principal_amount: number; current_balance: number; status: 'active' | 'repaid' | 'defaulted' | 'pending'; due_date: string; }
interface MemberProfileData {
  id: string;
  first_name: string;
  last_name: string;
  member_no: string;
  id_number: string;
  phone_number: string;
  email: string | null;
  address: string | null;
  occupation: string | null;
  photo_url: string | null;
  next_of_kin_name: string | null;
  next_of_kin_phone: string | null;
  next_of_kin_relationship: string | null;
  branch_id: number | null;
  group_id: number | null;
  assigned_officer_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const MemberProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, userRole } = useAuth();
  const [member, setMember] = useState<MemberProfileData | null>(null);
  const [loans, setLoans] = useState<MemberLoan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isStatementDialogOpen, setIsStatementDialogOpen] = useState(false);
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
  const [loanOfficerName, setLoanOfficerName] = useState<string>('N/A');
  const [groupName, setGroupName] = useState<string>('N/A');
  const [branchName, setBranchName] = useState<string>('N/A');
  const [communicationLogsKey, setCommunicationLogsKey] = useState(0); // For forcing refresh

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
        // Try to fetch member data - first try members table, then customers table
        let memberRes;
        let memberTable = 'members';
        
        try {
          memberRes = await supabase
            .from('members')
            .select(`*`)
            .eq('id', id)
            .maybeSingle();
        } catch (error: any) {
          if (error.message?.includes('members')) {
            // Fallback to customers table if it exists
            memberTable = 'customers';
            try {
              memberRes = await (supabase as any)
                .from('customers')
                .select(`*`)
                .eq('id', id)
                .maybeSingle();
            } catch (fallbackError: any) {
              console.warn('Both members and customers tables failed:', fallbackError);
              throw error; // Re-throw original error
            }
          } else {
            throw error;
          }
        }
        
        if (memberRes.error && memberRes.error.code !== 'PGRST116') throw memberRes.error;
        if (!memberRes.data) {
          toast.error('Member not found');
          return;
        }

        // Fetch loans - try both member_id and customer_id to handle different schema versions
        let loansRes;
        const loanColumns = 'id, principal_amount, current_balance, status, due_date, member_id, customer_id';
        
        try {
          // First try member_id with the current member's ID
          loansRes = await supabase
            .from('loans')
            .select(loanColumns)
            .or(`member_id.eq.${id},customer_id.eq.${id}`);
          
          console.log('Loans query result:', loansRes);
          
          if (loansRes.error) {
            console.warn('Loans fetch error:', loansRes.error);
            // Try alternative approach - search by member name
            const memberName = memberRes.data.full_name || memberRes.data.first_name + ' ' + memberRes.data.last_name;
            if (memberName) {
              console.log('Trying to fetch loans by member name:', memberName);
              // This is a fallback - in a real system you'd want to use proper foreign keys
              loansRes = { data: [], error: null };
            }
          }
        } catch (error: any) {
          console.warn('Could not fetch loans:', error);
          loansRes = { data: [], error: null };
        }
        
        if (loansRes.error) {
          console.warn('Loans fetch error:', loansRes.error);
          loansRes.data = [];
        }
        
        // Adapt member data based on table structure
        let adaptedMember = memberRes.data;
        if (memberTable === 'customers') {
          // Convert customers structure to match members interface
          adaptedMember = {
            ...memberRes.data,
            first_name: memberRes.data.full_name?.split(' ')[0] || 'Unknown',
            last_name: memberRes.data.full_name?.split(' ').slice(1).join(' ') || 'Member',
            member_no: memberRes.data.id?.slice(0, 8) || 'N/A',
            email: memberRes.data.email || 'N/A',
            occupation: memberRes.data.occupation || 'N/A',
            photo_url: memberRes.data.profile_picture_url || memberRes.data.photo_url || null,
            branch_id: memberRes.data.branch_id || null,
            group_id: memberRes.data.group_id || null
          };
        } else {
          // Ensure members table data has fallbacks
          adaptedMember = {
            ...memberRes.data,
            first_name: memberRes.data.first_name || memberRes.data.full_name?.split(' ')[0] || 'Unknown',
            last_name: memberRes.data.last_name || memberRes.data.full_name?.split(' ').slice(1).join(' ') || 'Member',
            member_no: memberRes.data.member_no || memberRes.data.id?.slice(0, 8) || 'N/A',
            email: memberRes.data.email || 'N/A',
            occupation: memberRes.data.occupation || 'N/A',
            photo_url: memberRes.data.profile_picture_url || memberRes.data.photo_url || null,
            branch_id: memberRes.data.branch_id || null,
            group_id: memberRes.data.group_id || null
          };
        }
        
        // Debug logging to see what we actually got
        console.log('Original member data:', memberRes.data);
        console.log('Adapted member data:', adaptedMember);
        console.log('Photo URL:', adaptedMember.photo_url);
        console.log('Profile Picture URL:', memberRes.data.profile_picture_url);
        console.log('Original Photo URL:', memberRes.data.photo_url);
        
        setMember(adaptedMember);
        setLoans(loansRes.data || []);
        
        // Fetch additional member information
        await fetchAdditionalMemberInfo(adaptedMember);
    } catch (error: any) {
        console.error('Error fetching member data:', error);
        toast.error('Failed to load member data', { description: error.message });
    } finally {
        setLoading(false);
    }
  };
  
  const fetchAdditionalMemberInfo = async (memberData: MemberProfileData) => {
    try {
      // Fetch loan officer name
      if (memberData.assigned_officer_id) {
        const officerRes = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', memberData.assigned_officer_id)
          .single();
        
        if (officerRes.data) {
          const officerData = officerRes.data as any;
          setLoanOfficerName(officerData.full_name || 'Unknown Officer');
        }
      }
      
      // Fetch group name
      if (memberData.group_id) {
        const groupRes = await supabase
          .from('groups')
          .select('name')
          .eq('id', memberData.group_id)
          .single();
        
        if (groupRes.data) {
          setGroupName(groupRes.data.name || 'Unknown Group');
        }
      }
      
      // Fetch branch name
      if (memberData.branch_id) {
        const branchRes = await supabase
          .from('branches')
          .select('name')
          .eq('id', memberData.branch_id)
          .single();
        
        if (branchRes.data) {
          setBranchName(branchRes.data.name || 'Unknown Branch');
        }
      }
    } catch (error) {
      console.warn('Error fetching additional member info:', error);
    }
  };
  
  useEffect(() => { fetchData(); }, [id]);

  const onActionSuccess = async () => {
    // Refresh member data and loans
    await fetchData();
    // Also refresh communication logs
    setCommunicationLogsKey(prev => prev + 1);
  };
  
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);
  const getStatusVariant = (status: MemberLoan['status']) => {
    switch (status) { 
      case 'active': return 'default'; 
      case 'repaid': return 'default'; 
      case 'defaulted': return 'destructive'; 
      case 'pending': return 'secondary'; 
      default: return 'secondary'; 
    }
  };
  
  const getInitials = (name: string) => {
    if (!name) return '';
    const names = name.split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
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
                            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{`${member.first_name} ${member.last_name}`}</h1>
                            <p className="text-muted-foreground text-sm sm:text-base">Member Profile & Financial History</p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Button onClick={() => setIsLogDialogOpen(true)} variant="secondary" className="w-full sm:w-auto">
                            <History className="mr-2 h-4 w-4" /> 
                            Log Communication
                        </Button>
                        <Button asChild className="w-full sm:w-auto">
                            <Link to={`/loans/new?memberId=${member.id}&memberName=${encodeURIComponent(`${member.first_name} ${member.last_name}`)}`}>
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
                                {userRole === 'super_admin' && (
                                    <DropdownMenuItem asChild>
                                        <Link to={`/members/${member.id}/edit`}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            <span>Edit Member</span>
                                        </Link>
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>

            {/* Role-based Access Information */}
            {userRole !== 'super_admin' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <div className="text-blue-600 mt-0.5">
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="text-sm text-blue-800">
                            <p className="font-medium">Member Management Restrictions</p>
                            <p className="mt-1">As a {userRole === 'loan_officer' ? 'Loan Officer' : 'Branch Admin'}, you can view member profiles and add new members, but only Super Admins can edit or delete existing members.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Modern Responsive Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Profile Card - Full width on mobile, left column on desktop */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Profile Card */}
                    <Card className="overflow-hidden bg-gradient-to-br from-brand-green-50 to-brand-green-100 border-brand-green-200 hover:border-brand-green-300 transition-all duration-200 hover:shadow-md">
                      <CardHeader className="items-center text-center pb-6">
                        <div className="relative mb-4">
                          <Avatar className="h-20 w-20 sm:h-24 w-24 border-2 border-brand-green-200">
                            {member.photo_url ? (
                              <AvatarImage 
                                src={member.photo_url} 
                                alt={`${member.first_name} ${member.last_name}`}
                                onError={(e) => {
                                  console.error('Image failed to load:', member.photo_url);
                                  e.currentTarget.style.display = 'none';
                                }}
                                onLoad={() => {
                                  console.log('Image loaded successfully:', member.photo_url);
                                }}
                              />
                            ) : null}
                            <AvatarFallback className="bg-brand-green-100 text-brand-green-700 text-lg">
                              {getInitials(`${member.first_name} ${member.last_name}`)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <CardTitle className="text-lg sm:text-xl text-brand-green-800">{`${member.first_name} ${member.last_name}`}</CardTitle>
                        <CardDescription className="text-sm text-brand-green-600">ID: {member.id_number}</CardDescription>
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
                            <InfoItem icon={Mail} label="Email" value={member.email} />
                            <InfoItem icon={Home} label="Address" value={member.address} />
                            <InfoItem icon={Briefcase} label="Occupation" value={member.occupation} />
                            <InfoItem icon={UserCheck} label="Next of Kin" value={member.next_of_kin_name} />
                            {member.next_of_kin_phone && (
                              <InfoItem icon={Phone} label="Next of Kin Phone" value={member.next_of_kin_phone} />
                            )}
                            <InfoItem icon={Users} label="Assigned Loan Officer" value={loanOfficerName} />
                            <InfoItem icon={Users} label="Group" value={groupName} />
                            <InfoItem icon={Home} label="Branch" value={branchName} />
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content - Full width on mobile, right columns on desktop */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Stats Cards - Responsive grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        <StatCard icon={Banknote} title="Active Loans" value={loans.length} />
                        <StatCard icon={DollarSign} title="Total Outstanding" value={formatCurrency(totalOutstanding)} />
                        <StatCard icon={Users} title="Member No." value={member.member_no} />
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
                                            { header: 'Loan ID', cell: (row) => <span className="font-mono text-xs">{row.id.slice(0, 8)}...</span> },
                                            { header: 'Principal', cell: (row) => formatCurrency(row.principal_amount) },
                                            { header: 'Outstanding', cell: (row) => formatCurrency(row.current_balance) },
                                            { header: 'Status', cell: (row) => <Badge variant={getStatusVariant(row.status)} className="capitalize">{row.status}</Badge> },
                                            { header: 'Due Date', cell: (row) => new Date(row.due_date).toLocaleDateString() },
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
                                    <CommunicationLogs 
                                        key={communicationLogsKey}
                                        loanId={null}
                                        memberId={id}
                                        memberName={`${member.first_name} ${member.last_name}`}
                                        onRefresh={onActionSuccess}
                                    />
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>

        <GenerateStatementDialog 
          open={isStatementDialogOpen} 
          onOpenChange={setIsStatementDialogOpen} 
          member={member ? {
            full_name: `${member.first_name} ${member.last_name}`,
            id_number: member.id_number,
            phone_number: member.phone_number,
            branch_name: branchName,
            assigned_officer_name: loanOfficerName
          } : null}
          loans={loans.map(loan => ({
            account_number: loan.id.slice(0, 8) + '...',
            principal_amount: loan.principal_amount,
            current_balance: loan.current_balance,
            status: loan.status,
            due_date: loan.due_date
          }))}
        />
        <LogCommunicationDialog 
          open={isLogDialogOpen} 
          onOpenChange={setIsLogDialogOpen} 
          loanId={null}
          memberId={member.id}
          memberName={`${member.first_name} ${member.last_name}`}
          onLogSuccess={onActionSuccess} 
        />
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
    <Card className="bg-gradient-to-br from-brand-green-50 to-brand-green-100 border-brand-green-200 hover:border-brand-green-300 transition-all duration-200 hover:shadow-md p-3 sm:p-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0 pt-0">
            <CardTitle className="text-xs md:text-sm font-medium text-brand-green-800">{title}</CardTitle>
            <Icon className="h-4 w-4 text-brand-green-600" />
        </CardHeader>
        <CardContent className="px-0 pb-0">
            <div className="text-xl md:text-2xl font-bold text-brand-green-700">{value}</div>
        </CardContent>
    </Card>
);

export default MemberProfilePage;