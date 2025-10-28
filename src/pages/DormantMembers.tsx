import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Users, ShieldAlert, Loader2, AlertTriangle, TrendingDown, DollarSign, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table';
import { ExportDropdown } from '@/components/ui/ExportDropdown';
import { ActivateMemberDialog } from '@/components/members/ActivateMemberDialog';

// --- Type Definitions ---
interface DormantMember {
  id: string;
  full_name: string;
  id_number: string;
  phone_number: string;
  branch_name?: string;
  last_activity_date: string;
  months_inactive: number;
  status: string;
  activation_fee_paid: boolean;
}

const DormantMembers: React.FC = () => {
  const { user, userRole } = useAuth();
  const [dormantMembers, setDormantMembers] = useState<DormantMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<DormantMember | null>(null);
  const [isActivateDialogOpen, setIsActivateDialogOpen] = useState(false);

  useEffect(() => {
    if (user && (userRole === 'super_admin' || userRole === 'branch_admin')) {
      fetchDormantMembers();
    } else {
      setLoading(false);
    }
  }, [user, userRole]);

  const fetchDormantMembers = async () => {
    if (!user) return;
    try {
      // Direct query instead of RPC to avoid function issues
      const { data, error } = await supabase
        .from('members')
        .select(`
          id,
          first_name,
          last_name,
          id_number,
          phone_number,
          last_activity_date,
          status,
          activation_fee_paid,
          branch_id
        `)
        .lt('last_activity_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .eq('status', 'active');
      
      if (error) throw error;

      // Fetch branch names for the members
      const branchIds = [...new Set((data || []).map(m => m.branch_id).filter(Boolean))];
      let branchesMap = new Map();
      
      if (branchIds.length > 0) {
        const { data: branchesData } = await supabase
          .from('branches')
          .select('id, name')
          .in('id', branchIds);
        
        branchesMap = new Map((branchesData || []).map(b => [b.id, b.name]));
      }

      // Format the data to match expected interface
      const formattedMembers = (data || []).map(member => {
        const fullName = member?.first_name && member?.last_name
          ? `${member.first_name} ${member.last_name}`.trim()
          : member?.first_name || member?.last_name || 'Unknown Member';
        
        const lastActivityDate = member.last_activity_date || new Date().toISOString();
        const monthsInactive = Math.floor(
          (Date.now() - new Date(lastActivityDate).getTime()) / (1000 * 60 * 60 * 24 * 30)
        );

        return {
          id: member.id,
          full_name: fullName,
          id_number: member.id_number,
          phone_number: member.phone_number,
          branch_name: branchesMap.get(member.branch_id) || 'Unknown Branch',
          last_activity_date: lastActivityDate,
          months_inactive: monthsInactive,
          status: member.status,
          activation_fee_paid: member.activation_fee_paid || false
        };
      });

      setDormantMembers(formattedMembers);
    } catch (error: any) {
      console.error('Failed to fetch dormant members:', error);
      toast.error('Failed to fetch dormant members', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleActivateMember = (member: DormantMember) => {
    setSelectedMember(member);
    setIsActivateDialogOpen(true);
  };

  const handleActivationSuccess = () => {
    setIsActivateDialogOpen(false);
    setSelectedMember(null);
    fetchDormantMembers(); // Refresh the list
    toast.success('Member activated successfully!');
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);

  const columns = [
    { 
      header: 'Member', 
      cell: (row: DormantMember) => (
        <Link to={`/members/${row.id}`} className="flex items-center gap-3 group">
          <div className="h-10 w-10 rounded-full bg-secondary flex-shrink-0 flex items-center justify-center border">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <div className="font-medium group-hover:underline">{row.full_name}</div>
            <div className="text-xs text-muted-foreground">ID: {row.id_number}</div>
            <div className="text-xs text-muted-foreground">{row.phone_number}</div>
          </div>
        </Link>
      )
    },
    { 
      header: 'Branch', 
      cell: (row: DormantMember) => row.branch_name || 'N/A' 
    },
    { 
      header: 'Last Activity', 
      cell: (row: DormantMember) => (
        <div>
          <div>{new Date(row.last_activity_date).toLocaleDateString()}</div>
          <div className="text-xs text-muted-foreground">
            {row.months_inactive} months ago
          </div>
        </div>
      )
    },
    { 
      header: 'Status', 
      cell: (row: DormantMember) => (
        <Badge variant={row.activation_fee_paid ? 'default' : 'destructive'}>
          {row.activation_fee_paid ? 'Activation Fee Paid' : 'Dormant'}
        </Badge>
      )
    },
    { 
      header: 'Actions', 
      cell: (row: DormantMember) => (
        <div className="flex gap-2">
          {!row.activation_fee_paid && userRole === 'super_admin' && (
            <Button 
              size="sm" 
              onClick={() => handleActivateMember(row)}
              className="bg-brand-blue-600 hover:bg-brand-blue-700"
            >
              <DollarSign className="h-4 w-4 mr-1" />
              Activate (KES 500)
            </Button>
          )}
          {row.activation_fee_paid && (
            <Badge variant="outline" className="text-green-600 border-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              Ready for Loans
            </Badge>
          )}
        </div>
      )
    },
  ];

  const exportColumns = [
    { header: 'Member Name', key: 'full_name' },
    { header: 'ID Number', key: 'id_number' },
    { header: 'Phone Number', key: 'phone_number' },
    { header: 'Branch', key: 'branch_name' },
    { header: 'Last Activity Date', key: 'last_activity_date' },
    { header: 'Months Inactive', key: 'months_inactive' },
    { header: 'Status', key: 'status' }
  ];

  if (loading) { 
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>; 
  }

  if (userRole !== 'super_admin' && userRole !== 'branch_admin') {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
        <div className="max-w-md">
          <ShieldAlert className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">
            Only Super Admins and Branch Admins can access the Dormant Members page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dormant Members</h1>
          <p className="text-muted-foreground mt-1">
            Members with no loan activity or payments for over 3 months. 
            {userRole === 'super_admin' && ' Super Admins can activate members by collecting KES 500 activation fee.'}
          </p>
        </div>
        <ExportDropdown 
          data={dormantMembers} 
          columns={exportColumns} 
          filename="dormant_members_report" 
          buttonText="Export Report" 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard 
          title="Total Dormant Members" 
          value={dormantMembers.length} 
          icon={Users} 
        />
        <StatCard 
          title="Avg. Months Inactive" 
          value={dormantMembers.length > 0 ? Math.round(dormantMembers.reduce((sum, m) => sum + m.months_inactive, 0) / dormantMembers.length) : 0} 
          icon={Clock} 
        />
        <StatCard 
          title="Critical Cases (>6 months)" 
          value={dormantMembers.filter(m => m.months_inactive > 6).length} 
          icon={AlertTriangle} 
        />
        <StatCard 
          title="Activation Fees Collected" 
          value={formatCurrency(dormantMembers.filter(m => m.activation_fee_paid).length * 500)} 
          icon={DollarSign}
        />
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Dormant Members List</CardTitle>
          <CardDescription>
            Members are considered dormant after 3 months of inactivity. 
            {userRole === 'super_admin' && ' Click "Activate" to collect the KES 500 activation fee and reactivate the member.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable 
            columns={columns} 
            data={dormantMembers} 
            emptyStateMessage="No dormant members found. All members are active!" 
          />
        </CardContent>
      </Card>

      {/* Activation Dialog */}
      {selectedMember && (
        <ActivateMemberDialog
          member={selectedMember}
          open={isActivateDialogOpen}
          onOpenChange={setIsActivateDialogOpen}
          onSuccess={handleActivationSuccess}
        />
      )}
    </div>
  );
};

const StatCard: React.FC<{
  title: string, 
  value: string | number, 
  icon: React.ElementType
}> = ({ title, value, icon: Icon }) => (
  <Card className="bg-gradient-to-br from-brand-blue-50 to-brand-blue-100 border-brand-blue-200 hover:border-brand-blue-300 transition-all duration-200 hover:shadow-md p-3 sm:p-4">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0 pt-0">
      <CardTitle className="text-xs md:text-sm font-medium text-brand-blue-800">{title}</CardTitle>
      <Icon className="h-4 w-4 text-brand-blue-600" />
    </CardHeader>
    <CardContent className="px-0 pb-0">
      <div className="text-xl md:text-2xl font-bold text-brand-blue-700">
        {value}
      </div>
    </CardContent>
  </Card>
);

export default DormantMembers;