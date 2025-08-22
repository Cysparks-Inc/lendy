import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Users, ShieldAlert, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table';
import { ExportDropdown } from '@/components/ui/ExportDropdown';

// --- Type Definitions ---
interface MasterRecord {
  id: string;
  full_name: string;
  id_number: string;
  phone_number: string;
  status: string;
  created_at: string;
  branch_name?: string;
  total_loans: number;
  outstanding_balance: number;
  last_payment_date?: string;
  profile_picture_url?: string;
}

const MasterRoll: React.FC = () => {
  const { user, userRole } = useAuth();
  const [records, setRecords] = useState<MasterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (userRole === 'super_admin' || userRole === 'branch_manager') {
      fetchMasterRoll();

      // --- REAL-TIME DATA SYNC ---
      const subscription = supabase.channel('master-roll-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => fetchMasterRoll())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => fetchMasterRoll())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchMasterRoll())
        .subscribe();
      
      return () => { supabase.removeChannel(subscription); };
    } else {
      setLoading(false);
    }
  }, [user, userRole]);

  const fetchMasterRoll = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc('get_master_roll_data', { requesting_user_id: user.id });
      if (error) throw error;
      setRecords(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch Master Roll', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = records.filter(record =>
    record.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.id_number.includes(searchTerm) ||
    record.phone_number.includes(searchTerm)
  );

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);

  const columns = [
    { header: 'Member', cell: (row: MasterRecord) => (
      <Link to={`/members/${row.id}`} className="flex items-center gap-2 group">
        <div className="h-8 w-8 rounded-full bg-secondary flex-shrink-0 flex items-center justify-center border">
          {row.profile_picture_url ? (<img src={row.profile_picture_url} alt={row.full_name} className="h-full w-full object-cover rounded-full" />) : (<Users className="h-4 w-4 text-muted-foreground" />)}
        </div>
        <div>
          <div className="font-medium group-hover:underline">{row.full_name}</div>
          <div className="text-xs text-muted-foreground">{row.id_number}</div>
        </div>
      </Link>
    )},
    { header: 'Contact', cell: (row: MasterRecord) => row.phone_number },
    { header: 'Branch', cell: (row: MasterRecord) => row.branch_name },
    { header: 'Status', cell: (row: MasterRecord) => <Badge variant={row.status === 'active' ? 'default' : 'secondary'} className="capitalize">{row.status}</Badge> },
    { header: 'Outstanding', cell: (row: MasterRecord) => <div className="font-mono text-right">{formatCurrency(row.outstanding_balance)}</div> },
    { header: 'Last Payment', cell: (row: MasterRecord) => row.last_payment_date ? new Date(row.last_payment_date).toLocaleDateString() : <span className="text-muted-foreground">N/A</span> },
  ];
  
  const exportColumns = [
    { header: 'Name', accessorKey: 'full_name' },
    { header: 'ID Number', accessorKey: 'id_number' },
    { header: 'Phone', accessorKey: 'phone_number' },
    { header: 'Branch', accessorKey: 'branch_name' },
    { header: 'Status', accessorKey: 'status' },
    { header: 'Total Loans', accessorKey: 'total_loans' },
    { header: 'Outstanding Balance', accessorKey: (row: MasterRecord) => formatCurrency(row.outstanding_balance) },
    { header: 'Last Payment Date', accessorKey: 'last_payment_date' },
  ];

  if (loading) { return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>; }

  // --- Frontend Access Control ---
  if (userRole !== 'super_admin' && userRole !== 'branch_manager') {
    return (
      <div className="p-2 sm:p-4 md:p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-yellow-500" />
            <CardTitle className="mt-4">Access Denied</CardTitle>
            <CardDescription>You do not have the required permissions to view the Master Roll.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Master Roll</h1>
          <p className="text-muted-foreground">Complete member registry and financial overview.</p>
        </div>
        <ExportDropdown 
          data={filteredRecords} 
          columns={exportColumns} 
          fileName="master-roll-report" 
          reportTitle="Master Roll Report"
        />
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Members" value={records.length} />
        <StatCard title="Active Members" value={records.filter(r => r.status === 'active').length} />
        <StatCard title="With Loans" value={records.filter(r => r.total_loans > 0).length} />
        <StatCard title="Total Outstanding" value={formatCurrency(records.reduce((sum, r) => sum + r.outstanding_balance, 0))} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <CardTitle>Member Records</CardTitle>
                <CardDescription>Showing {filteredRecords.length} of {records.length} members.</CardDescription>
            </div>
            <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by name, ID, or phone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={filteredRecords} emptyStateMessage="No member records found." />
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard: React.FC<{title: string, value: string | number}> = ({ title, value }) => (
  <Card className="bg-gradient-to-br from-brand-green-50 to-brand-green-100 border-brand-green-200 hover:border-brand-green-300 transition-all duration-200 hover:shadow-md">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium text-brand-green-800">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-brand-green-700">{value}</div>
    </CardContent>
  </Card>
);

export default MasterRoll;