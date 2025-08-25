import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Users, ShieldAlert, Loader2, AlertTriangle, TrendingDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table';
import { ExportDropdown } from '@/components/ui/ExportDropdown';

// --- Type Definitions ---
interface DormantMember {
  id: string;
  full_name: string;
  phone_number: string;
  branch_name?: string;
  last_payment_date?: string;
  days_inactive: number;
  status: string;
  profile_picture_url?: string;
  outstanding_balance: number;
}

const DormantMembers: React.FC = () => {
  const { user, userRole } = useAuth();
  const [dormantMembers, setDormantMembers] = useState<DormantMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Access control is handled by the RPC function, but we can prevent unnecessary fetches.
    if (user) {
      fetchDormantMembers();

      // Subscribe to changes that could affect dormancy status
      const subscription = supabase.channel('dormant-members-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, fetchDormantMembers)
        .subscribe();
      
      return () => { supabase.removeChannel(subscription); };
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchDormantMembers = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc('get_dormant_members_report', { requesting_user_id: user.id });
      if (error) throw error;
      setDormantMembers(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch dormant members', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);

  const columns = [
    { header: 'Member', cell: (row: DormantMember) => (
      <Link to={`/members/${row.id}`} className="flex items-center gap-3 group">
        <div className="h-10 w-10 rounded-full bg-secondary flex-shrink-0 flex items-center justify-center border">
          {row.profile_picture_url ? (<img src={row.profile_picture_url} alt={row.full_name} className="h-full w-full object-cover rounded-full" />) : (<Users className="h-5 w-5 text-muted-foreground" />)}
        </div>
        <div>
          <div className="font-medium group-hover:underline">{row.full_name}</div>
          <div className="text-xs text-muted-foreground">{row.phone_number}</div>
        </div>
      </Link>
    )},
    { header: 'Branch', cell: (row: DormantMember) => row.branch_name || 'N/A' },
    { header: 'Last Payment', cell: (row: DormantMember) => row.last_payment_date ? new Date(row.last_payment_date).toLocaleDateString() : <span className="text-xs text-muted-foreground">No Payments</span> },
    { header: 'Days Inactive', cell: (row: DormantMember) => <Badge variant={row.days_inactive > 180 ? 'destructive' : 'secondary'}>{row.days_inactive} days</Badge> },
    { header: 'Outstanding', cell: (row: DormantMember) => <div className="font-mono text-right">{formatCurrency(row.outstanding_balance)}</div> },
  ];

  const exportColumns = columns.map(c => ({ header: c.header, accessorKey: (row: DormantMember) => c.cell(row) }));

  if (loading) { return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>; }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dormant Members Report</h1>
          <p className="text-muted-foreground mt-1">Members with no payment activity for over 90 days.</p>
        </div>
        <ExportDropdown data={dormantMembers} columns={exportColumns} fileName="dormant_members_report" reportTitle="Dormant Members Report" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Total Dormant Members" value={dormantMembers.length} icon={Users} />
        <StatCard title="Avg. Days Inactive" value={dormantMembers.length > 0 ? Math.round(dormantMembers.reduce((sum, m) => sum + m.days_inactive, 0) / dormantMembers.length) : 0} icon={Clock} />
        <StatCard title="Critical Cases (>180 Days)" value={dormantMembers.filter(m => m.days_inactive > 180).length} icon={AlertTriangle} />
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Dormant Members List</CardTitle>
          <CardDescription>This report is generated based on the last payment date for any loan associated with a member.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={dormantMembers} emptyStateMessage="No dormant members found." />
        </CardContent>
      </Card>
    </div>
  );
};

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

export default DormantMembers;