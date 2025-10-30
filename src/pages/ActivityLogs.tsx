import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';

type LogRow = {
  id: string;
  user_id: string;
  event: 'login' | 'logout';
  ip?: string;
  user_agent?: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
  is_online?: boolean;
};

const ActivityLogs: React.FC = () => {
  const { userRole } = useAuth();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 200;
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let timer: any;
    const load = async () => {
      if (userRole !== 'super_admin') { setLoading(false); return; }
      try {
        // cleanup retention window (best-effort)
        try { await supabase.rpc('cleanup_auth_logs_30d'); } catch {}

        // fetch count for pagination
        const { count } = await supabase
          .from('auth_logs')
          .select('*', { count: 'exact', head: true });
        setTotal(count || 0);

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data: logs, error } = await supabase
          .from('auth_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, to);
        if (error) throw error;
        const userIds = Array.from(new Set((logs || []).map(l => l.user_id).filter(Boolean)));
        const { data: profiles } = userIds.length > 0 ? await supabase.from('profiles').select('id, email, full_name, is_online, last_seen').in('id', userIds) : { data: [] } as any;
        const map = new Map((profiles || []).map(p => [p.id, p]));
        const mapped = (logs || []).map(l => ({
          ...l,
          user_email: map.get(l.user_id)?.email,
          user_name: map.get(l.user_id)?.full_name,
          is_online: map.get(l.user_id)?.is_online,
        })) as LogRow[];

        // client-side text filter across key columns
        const s = search.trim().toLowerCase();
        const filtered = s
          ? mapped.filter(r =>
              (r.user_name || '').toLowerCase().includes(s) ||
              (r.user_email || '').toLowerCase().includes(s) ||
              (r.ip || '').toLowerCase().includes(s) ||
              (r.user_agent || '').toLowerCase().includes(s) ||
              (r.event || '').toLowerCase().includes(s)
            )
          : mapped;
        setRows(filtered);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    load();
    timer = setInterval(load, 20 * 1000);
    return () => clearInterval(timer);
  }, [userRole, page, search]);

  if (userRole !== 'super_admin') {
    return (
      <div className="p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Only Super Admins can view activity logs.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <div className="p-6">Loading logs...</div>;
  }

  return (
    <div className="p-2 sm:p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Authentication Activity</CardTitle>
          <CardDescription>Recent logins, logouts, and presence overview</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search user, IP, agent, event..." className="border rounded px-2 py-1 text-sm w-full max-w-md" />
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="border rounded px-2 py-1 text-sm">Prev</button>
              <span className="text-xs">Page {page} / {Math.max(1, Math.ceil(total / pageSize))}</span>
              <button disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage(p => p + 1)} className="border rounded px-2 py-1 text-sm">Next</button>
            </div>
          </div>

          <DataTable
            columns={[
              { header: 'When', cell: (r: LogRow) => new Date(r.created_at).toLocaleString() },
              { header: 'User', cell: (r: LogRow) => (
                <div className="flex items-center gap-2">
                  <span>{r.user_name || r.user_email || (r.user_id ? r.user_id.slice(0,8) : '-') }</span>
                  {r.is_online && <Badge variant="default">online</Badge>}
                </div>
              ) },
              { header: 'Event', cell: (r: LogRow) => <Badge variant={r.event === 'login' ? 'default' : 'secondary'}>{r.event}</Badge> },
              { header: 'IP', cell: (r: LogRow) => r.ip || '-' },
              { header: 'User Agent', cell: (r: LogRow) => r.user_agent?.slice(0,80) || '-' },
            ]}
            data={rows}
            emptyStateMessage="No activity yet"
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivityLogs;


