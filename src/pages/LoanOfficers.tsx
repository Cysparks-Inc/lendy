import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserCheck, Users, CreditCard, UsersRound as GroupsIcon, Search } from 'lucide-react';

type Officer = { id: string; full_name: string | null; email: string | null };
type Member = { id: string; first_name: string | null; last_name: string | null; full_name?: string | null; phone_number?: string | null; branch_id?: string | null; group_id?: string | null };
type Loan = { id: string; principal_amount: number | null; current_balance: number | null; status: 'active' | 'repaid' | 'defaulted' | 'pending' } & { member_id?: string | null; loan_officer_id?: string | null };
type Group = { id: string; name: string | null };

const LoanOfficers: React.FC = () => {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [search, setSearch] = useState('');
  const [selectedOfficer, setSelectedOfficer] = useState<Officer | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    if (!(userRole === 'super_admin' || userRole === 'admin')) return;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'loan_officer')
        .order('full_name');
      if (!error) {
        setOfficers(data || []);
        setSelectedOfficer((data || [])[0] || null);
      }
      setLoading(false);
    };
    load();
  }, [userRole]);

  useEffect(() => {
    if (!selectedOfficer) return;
    const fetchDetails = async () => {
      const membersRes = await supabase
        .from('members')
        .select('id, first_name, last_name, full_name, phone_number, branch_id, group_id')
        .eq('assigned_officer_id', selectedOfficer.id);

      if (!membersRes.error) setMembers(membersRes.data || []);

      const memberIds = (membersRes.data || []).map(m => m.id);

      // Fetch loans directly assigned to officer
      const directLoansRes = await supabase
        .from('loans')
        .select('id, principal_amount, current_balance, status, member_id, loan_officer_id')
        .eq('loan_officer_id', selectedOfficer.id);

      // Fetch loans for members assigned to officer where loan_officer_id is null or different
      let memberLoansRes: any = { data: [] };
      if (memberIds.length > 0) {
        memberLoansRes = await supabase
          .from('loans')
          .select('id, principal_amount, current_balance, status, member_id, loan_officer_id')
          .in('member_id', memberIds);
      }

      const combinedLoans: Loan[] = Array.from(
        new Map([...(directLoansRes.data || []), ...(memberLoansRes.data || [])].map((l: any) => [l.id, l]))
      ).map(([, v]) => v) as Loan[];
      setLoans(combinedLoans);

      const groupIds = Array.from(new Set((membersRes.data || []).map(m => m.group_id).filter(Boolean))) as string[];
      if (groupIds.length > 0) {
        const { data: groupData } = await supabase.from('groups').select('id, name').in('id', groupIds);
        setGroups(groupData || []);
      } else {
        setGroups([]);
      }
    };
    fetchDetails();
  }, [selectedOfficer]);

  const filteredOfficers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return officers;
    return officers.filter(o => (o.full_name || '').toLowerCase().includes(term) || (o.email || '').toLowerCase().includes(term));
  }, [officers, search]);

  const stats = useMemo(() => {
    const totalDisbursed = loans.reduce((s, l) => s + (l.principal_amount || 0), 0);
    const outstanding = loans.filter(l => l.status !== 'repaid').reduce((s, l) => s + Math.max(l.current_balance || 0, 0), 0);
    const active = loans.filter(l => l.status === 'active' || l.status === 'pending').length;
    const repaid = loans.filter(l => l.status === 'repaid').length;
    const defaulted = loans.filter(l => l.status === 'defaulted').length;
    return { totalDisbursed, outstanding, active, repaid, defaulted };
  }, [loans]);

  if (!(userRole === 'super_admin' || userRole === 'admin')) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Only Super Admins and Admins can view Loan Officers.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Loan Officers</h1>
          <p className="text-muted-foreground">Browse officers and drill into their members, loans and groups.</p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search officers by name or email" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5" /> Officers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[70vh] overflow-auto">
            {filteredOfficers.map(o => (
              <Button key={o.id} variant={selectedOfficer?.id === o.id ? 'default' : 'outline'} className="w-full justify-start" onClick={() => setSelectedOfficer(o)}>
                <div className="text-left">
                  <div className="font-medium">{o.full_name || 'Unnamed Officer'}</div>
                  <div className="text-xs text-muted-foreground">{o.email}</div>
                </div>
              </Button>
            ))}
            {filteredOfficers.length === 0 && <div className="text-sm text-muted-foreground">No officers found.</div>}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{selectedOfficer?.full_name || 'Select an Officer'}</CardTitle>
              <CardDescription>{selectedOfficer?.email}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Metric title="Members" value={members.length} icon={Users} />
                <Metric title="Loans" value={loans.length} icon={CreditCard} />
                <Metric title="Disbursed" value={formatCurrency(stats.totalDisbursed)} icon={CreditCard} />
                <Metric title="Outstanding" value={formatCurrency(stats.outstanding)} icon={CreditCard} />
                <Metric title="Active" value={stats.active} icon={CreditCard} />
                <Metric title="Repaid" value={stats.repaid} icon={CreditCard} />
                <Metric title="Defaulted" value={stats.defaulted} icon={CreditCard} />
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="members">
            <TabsList>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="loans">Loans</TabsTrigger>
              <TabsTrigger value="groups">Groups</TabsTrigger>
            </TabsList>

            <TabsContent value="members">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Members</CardTitle>
                  <CardDescription>Members assigned to this officer.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="py-2">Name</th>
                          <th className="py-2">Phone</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map(m => (
                          <tr key={m.id} className="border-t">
                            <td className="py-2">{m.full_name || `${m.first_name || ''} ${m.last_name || ''}`}</td>
                            <td className="py-2">{m.phone_number || '—'}</td>
                          </tr>
                        ))}
                        {members.length === 0 && (
                          <tr><td className="py-4 text-muted-foreground" colSpan={3}>No members found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="loans">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Loans</CardTitle>
                  <CardDescription>Loans attached to this officer.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="py-2">Loan ID</th>
                          <th className="py-2">Principal</th>
                          <th className="py-2">Outstanding</th>
                          <th className="py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loans.map(l => (
                          <tr key={l.id} className="border-t">
                            <td className="py-2">{l.id.slice(0, 8)}</td>
                            <td className="py-2">{formatCurrency(l.principal_amount || 0)}</td>
                            <td className="py-2">{formatCurrency(Math.max(l.current_balance || 0, 0))}</td>
                            <td className="py-2">
                              <Badge variant={statusVariant(l.status)} className="capitalize">{l.status}</Badge>
                            </td>
                          </tr>
                        ))}
                        {loans.length === 0 && (
                          <tr><td className="py-4 text-muted-foreground" colSpan={4}>No loans found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="groups">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><GroupsIcon className="h-4 w-4" /> Groups</CardTitle>
                  <CardDescription>Groups containing this officer’s members.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="py-2">Name</th>
                          <th className="py-2">Members in Group (assigned)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groups.map(g => (
                          <tr key={g.id} className="border-t">
                            <td className="py-2">{g.name || 'Unnamed group'}</td>
                            <td className="py-2">{members.filter(m => m.group_id === g.id).length}</td>
                          </tr>
                        ))}
                        {groups.length === 0 && (
                          <tr><td className="py-4 text-muted-foreground" colSpan={2}>No groups found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

const Metric: React.FC<{ title: string; value: string | number; icon: React.ElementType }> = ({ title, value, icon: Icon }) => (
  <Card className="bg-gradient-to-br from-brand-blue-50 to-brand-blue-100 border-brand-blue-200">
    <CardHeader className="pb-2">
      <CardTitle className="text-xs text-brand-blue-800 flex items-center gap-2"><Icon className="h-4 w-4 text-brand-blue-600" /> {title}</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-xl font-bold text-brand-blue-700">{value}</div>
    </CardContent>
  </Card>
);

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount || 0);

const statusVariant = (status: Loan['status']) => {
  switch (status) {
    case 'active': return 'default' as const;
    case 'repaid': return 'success' as const;
    case 'defaulted': return 'destructive' as const;
    case 'pending': return 'warning' as const;
    default: return 'secondary' as const;
  }
};

export default LoanOfficers;


