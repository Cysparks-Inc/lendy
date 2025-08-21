import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ShieldAlert, DollarSign, Target, TrendingUp, Loader2, Plus, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table';
import { ExportDropdown } from '@/components/ui/ExportDropdown';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

// --- Type Definitions ---
interface RealizableItem {
  id: string;
  asset_type: string;
  description: string;
  member_name?: string;
  loan_account_number?: string;
  member_id?: string;
  loan_id?: string;
  realizable_value: number;
  current_market_value: number;
  recovery_likelihood: 'high' | 'medium' | 'low';
  branch_name: string;
  status: string;
}

const RealizableReport: React.FC = () => {
  const { user, userRole } = useAuth();
  const [items, setItems] = useState<RealizableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteCandidate, setDeleteCandidate] = useState<RealizableItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- Secure, Role-Based Data Fetching ---
  const fetchData = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc('get_realizable_assets_report', { requesting_user_id: user.id });
      if (error) throw error;
      setItems(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch report data', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole === 'super_admin' || userRole === 'branch_manager') {
      fetchData();
      
      // Subscribe to real-time changes
      const subscription = supabase.channel('realizable-assets-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'realizable_assets' }, () => {
          toast.info("Asset data has been updated.");
          fetchData();
        })
        .subscribe();
      
      return () => { supabase.removeChannel(subscription); };
    } else {
      setLoading(false); // If user doesn't have the role, stop loading and show access denied.
    }
  }, [user, userRole]);

  const handleDelete = async () => {
    if (!deleteCandidate) return;
    setIsDeleting(true);
    try {
        const { error } = await supabase.from('realizable_assets').delete().eq('id', deleteCandidate.id);
        if (error) throw error;
        toast.success("Asset deleted successfully.");
        setDeleteCandidate(null);
        await fetchData(); // Refresh data after delete
    } catch(error: any) {
        toast.error("Failed to delete asset", { description: error.message });
    } finally {
        setIsDeleting(false);
    }
  };

  const filteredItems = items.filter(item =>
    item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.member_name && item.member_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);
  const getLikelihoodVariant = (likelihood: string) => {
    switch (likelihood) { case 'high': return 'success'; case 'medium': return 'warning'; case 'low': return 'destructive'; default: return 'secondary'; }
  };

  const columns = [
    { header: 'Asset', cell: (row: RealizableItem) => <div><p className="font-medium">{row.description}</p><Badge variant="outline" className="capitalize mt-1">{row.asset_type.replace('_', ' ')}</Badge></div> },
    { header: 'Associated With', cell: (row: RealizableItem) => row.member_name ? <div><Link to={`/members/${row.member_id}`} className="hover:underline text-primary">{row.member_name}</Link><p className="text-xs text-muted-foreground font-mono">{row.loan_account_number}</p></div> : <span className="text-muted-foreground">N/A</span> },
    { header: 'Realizable Value', cell: (row: RealizableItem) => <p className="font-mono text-right text-green-600">{formatCurrency(row.realizable_value)}</p> },
    { header: 'Recovery Likelihood', cell: (row: RealizableItem) => <Badge variant={getLikelihoodVariant(row.recovery_likelihood)} className="capitalize">{row.recovery_likelihood}</Badge> },
    { header: 'Branch', cell: (row: RealizableItem) => row.branch_name },
    { header: 'Status', cell: (row: RealizableItem) => <Badge variant={row.status === 'disputed' ? 'destructive' : 'secondary'} className="capitalize">{row.status.replace('_', ' ')}</Badge> },
    { header: 'Actions', cell: (row: RealizableItem) => (
        <div className="flex justify-end gap-2">
            <Button asChild variant="outline" size="icon"><Link to={`/realizable-assets/${row.id}/edit`}><Edit className="h-4 w-4" /></Link></Button>
            <Button variant="destructive" size="icon" onClick={() => setDeleteCandidate(row)}><Trash2 className="h-4 w-4" /></Button>
        </div>
    )},
  ];

  const exportColumns = [
    { header: 'Asset Description', accessorKey: 'description' },
    { header: 'Asset Type', accessorKey: 'asset_type' },
    { header: 'Member', accessorKey: 'member_name' },
    { header: 'Loan Account', accessorKey: 'loan_account_number' },
    { header: 'Branch', accessorKey: 'branch_name' },
    { header: 'Realizable Value', accessorKey: (row: RealizableItem) => formatCurrency(row.realizable_value) },
    { header: 'Market Value', accessorKey: (row: RealizableItem) => formatCurrency(row.current_market_value) },
    { header: 'Status', accessorKey: 'status' },
  ];

  const totalRealizableValue = filteredItems.reduce((sum, item) => sum + item.realizable_value, 0);
  const totalMarketValue = filteredItems.reduce((sum, item) => sum + item.current_market_value, 0);

  if (loading) { return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>; }

  if (userRole !== 'super_admin' && userRole !== 'branch_manager') {
    return (
      <div className="p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-yellow-500" />
            <CardTitle className="mt-4">Access Denied</CardTitle>
            <CardDescription>You do not have the required permissions to view this report.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Realizable Assets</h1>
          <p className="text-muted-foreground mt-1">Manage and evaluate all recoverable assets in your scope.</p>
        </div>
        <div className="flex gap-2">
            <ExportDropdown data={filteredItems} columns={exportColumns} fileName="realizable_assets_report" reportTitle="Realizable Assets Report" />
            <Button asChild><Link to="/realizable-assets/new"><Plus className="mr-2 h-4 w-4" />Add Asset</Link></Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Total Assets Tracked" value={filteredItems.length} icon={Target} />
        <StatCard title="Total Market Value" value={formatCurrency(totalMarketValue)} icon={TrendingUp} />
        <StatCard title="Total Realizable Value" value={formatCurrency(totalRealizableValue)} icon={DollarSign} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <CardTitle>Asset Details</CardTitle>
              <CardDescription>Showing {filteredItems.length} of {items.length} assets.</CardDescription>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by asset or member..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={filteredItems} emptyStateMessage="No realizable assets found." />
        </CardContent>
      </Card>

      <Dialog open={!!deleteCandidate} onOpenChange={() => setDeleteCandidate(null)}>
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogDescription>Are you sure you want to delete the asset: <strong>{deleteCandidate?.description}</strong>? This action cannot be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter className="pt-4">
                <Button variant="outline" onClick={() => setDeleteCandidate(null)} disabled={isDeleting}>Cancel</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete Asset
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatCard: React.FC<{title: string, value: string | number, icon: React.ElementType}> = ({ title, value, icon: Icon }) => (
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" />{title}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card>
);

export default RealizableReport;