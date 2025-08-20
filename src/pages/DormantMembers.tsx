import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollableContainer } from '@/components/ui/scrollable-container';
import { Users, Clock, Phone, MapPin } from 'lucide-react';
import { Loader } from '@/components/ui/loader';

interface DormantMember {
  id: string;
  full_name: string;
  phone_number: string;
  group_name?: string;
  branch_name?: string;
  last_payment_date?: string;
  days_inactive: number;
  status: string;
}

const DormantMembers = () => {
  const [dormantMembers, setDormantMembers] = useState<DormantMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDormantMembers();
  }, []);

  const fetchDormantMembers = async () => {
    try {
      // Query members who haven't made payments in the last 90 days
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select(`
          id,
          full_name,
          phone_number,
          status,
          groups:group_id (
            id,
            name
          ),
          branches:branch_id (
            id,
            name
          )
        `);

      if (membersError) throw membersError;

      // For each member, check their last payment date
      const dormantMembersData: DormantMember[] = [];
      
      for (const member of membersData || []) {
        const { data: repayments } = await supabase
          .from('repayments')
          .select('payment_date')
          .eq('loan_id', member.id)
          .order('payment_date', { ascending: false })
          .limit(1);

        const lastPaymentDate = repayments?.[0]?.payment_date;
        const daysSinceLastPayment = lastPaymentDate 
          ? Math.floor((new Date().getTime() - new Date(lastPaymentDate).getTime()) / (1000 * 3600 * 24))
          : 999; // If no payments, consider as very dormant

        if (daysSinceLastPayment > 90) {
          dormantMembersData.push({
            id: member.id,
            full_name: member.full_name,
            phone_number: member.phone_number,
            group_name: member.groups?.name,
            branch_name: member.branches?.name,
            last_payment_date: lastPaymentDate,
            days_inactive: daysSinceLastPayment,
            status: member.status
          });
        }
      }

      setDormantMembers(dormantMembersData);
    } catch (error) {
      console.error('Error fetching dormant members:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loader size="lg" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dormant Members List</h1>
        <p className="text-muted-foreground">Members with no recent activity (90+ days)</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Total Dormant</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{dormantMembers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Avg Days Inactive</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-muted-foreground">
              {dormantMembers.length > 0 
                ? Math.round(dormantMembers.reduce((sum, m) => sum + m.days_inactive, 0) / dormantMembers.length)
                : 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Critical Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">
              {dormantMembers.filter(m => m.days_inactive > 180).length}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Dormant Members</CardTitle>
          <CardDescription>Members inactive for over 90 days</CardDescription>
        </CardHeader>
        <CardContent>
          {dormantMembers.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No dormant members found.</p>
            </div>
          ) : (
            <ScrollableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Group & Branch</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead>Days Inactive</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dormantMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-destructive" />
                          </div>
                          <div className="font-medium">{member.full_name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />
                          {member.phone_number}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">{member.group_name || 'No Group'}</div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {member.branch_name || 'No Branch'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {member.last_payment_date ? (
                          <div className="text-sm">
                            {new Date(member.last_payment_date).toLocaleDateString()}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No payments</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.days_inactive > 180 ? 'destructive' : 'secondary'}>
                          {member.days_inactive} days
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                          {member.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DormantMembers;