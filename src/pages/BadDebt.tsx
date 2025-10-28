import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Download, FileText, AlertTriangle, Search } from 'lucide-react';
import { toast } from 'sonner';
import { fixData, fixColumns } from '@/utils/typeUtils';

interface BadDebtStats {
  totalWrittenOff: number;
  totalValue: number;
}

interface BadDebtRecord {
  id: string;
  account_number: string;
  member_name: string;
  member_id: string;
  principal_amount: number;
  written_off_balance: number;
  loan_officer_name: string;
  branch_name: string;
  written_off_date: string;
}

const BadDebt: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<BadDebtStats>({ totalWrittenOff: 0, totalValue: 0 });
  const [records, setRecords] = useState<BadDebtRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user) {
      fetchBadDebtData();
    }
  }, [user]);

  const fetchBadDebtData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data: badDebtData, error: badDebtError } = await (supabase as any)
        .rpc('get_bad_debt_loans', { requesting_user_id: user.id });

      if (badDebtError) {
        console.error('Error fetching bad debt loans:', badDebtError);
        console.error('Detailed error details:', badDebtError);
        throw badDebtError;
      }

      console.log('Bad debt loans fetched:', fixData(badDebtData)?.length || 0);

      const enrichedRecords: BadDebtRecord[] = (fixData(badDebtData) || []).map((loan: any) => ({
        id: loan.id,
        account_number: loan.account_number,
        member_name: loan.member_name,
        member_id: loan.member_id,
        principal_amount: loan.principal_amount,
        written_off_balance: loan.written_off_balance,
        loan_officer_name: loan.loan_officer_name,
        branch_name: loan.branch_name,
        written_off_date: loan.written_off_date,
      }));

      setRecords(enrichedRecords);
      setStats({
        totalWrittenOff: enrichedRecords.length,
        totalValue: enrichedRecords.reduce((sum, record) => sum + record.written_off_balance, 0)
      });

    } catch (error) {
      console.error('Error fetching bad debt data:', error);
      toast.error('Failed to fetch bad debt data');
    } finally {
      setLoading(false);
    }
  };

  const columns = fixColumns([
    { header: 'Account Number', accessorKey: 'account_number' },
    { header: 'Member Name', accessorKey: 'member_name' },
    { header: 'Principal Amount', accessorKey: 'principal_amount' },
    { header: 'Written Off Balance', accessorKey: 'written_off_balance' },
    { header: 'Loan Officer', accessorKey: 'loan_officer_name' },
    { header: 'Branch', accessorKey: 'branch_name' },
    { header: 'Written Off Date', accessorKey: 'written_off_date' },
  ]);

  const filteredRecords = records.filter(record =>
    record.member_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.account_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.branch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.loan_officer_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Bad Debt Report</h1>
          <p className="text-muted-foreground">Monitor loans written off as bad debt</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Written Off</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalWrittenOff}</div>
            <p className="text-xs text-muted-foreground">Loans written off as bad debt</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {stats.totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total value of bad debt</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bad Debt Records</CardTitle>
          <CardDescription>
            Detailed list of all loans written off as bad debt
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by member name, account number, branch, or loan officer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <DataTable
            columns={columns}
            data={filteredRecords}
            emptyStateMessage="No bad debt records found."
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default BadDebt;