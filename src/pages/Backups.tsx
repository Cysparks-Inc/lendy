import React, { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type BackupRow = {
  id: string
  created_at: string
  created_by: string | null
  path: string
  object_count: number
  total_size_bytes: number | null
  status: string
}

const Backups: React.FC = () => {
  const { userRole } = useAuth()
  const [rows, setRows] = useState<BackupRow[]>([])
  const [running, setRunning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expandedPath, setExpandedPath] = useState<string | null>(null)
  const [files, setFiles] = useState<{ name: string; size: number }[]>([])
  const [restoreTable, setRestoreTable] = useState<string>('members')
  const [restoreFile, setRestoreFile] = useState<File | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!['super_admin','admin'].includes(userRole || '')) { setLoading(false); return }
      try {
        const { data } = await supabase.from('backup_metadata').select('*').order('created_at', { ascending: false }).limit(20)
        setRows((data || []) as any)
      } finally { setLoading(false) }
    }
    load()
  }, [userRole])

  const runBackup = async () => {
    setRunning(true)
    try {
      await supabase.functions.invoke('backup-snapshot')
      const { data } = await supabase.from('backup_metadata').select('*').order('created_at', { ascending: false }).limit(20)
      setRows((data || []) as any)
    } finally { setRunning(false) }
  }

  const openFiles = async (path: string) => {
    setExpandedPath(path)
    try {
      const { data, error } = await supabase.storage.from('backups').list(path)
      if (!error) setFiles((data || []).map((f: any) => ({ name: f.name, size: f.metadata?.size || f.size || 0 })))
    } catch {}
  }

  const downloadFile = async (path: string, name: string) => {
    try {
      const fullPath = `${path}/${name}`
      const { data, error } = await supabase.storage.from('backups').createSignedUrl(fullPath, 60)
      if (!error && data?.signedUrl) {
        window.open(data.signedUrl, '_blank')
      }
    } catch {}
  }

  // Simple CSV parser for restore (works for our own exports)
  const parseCsv = (text: string): { headers: string[]; rows: Record<string, string>[] } => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
    if (lines.length === 0) return { headers: [], rows: [] }
    const split = (line: string) => {
      const out: string[] = []
      let cur = ''
      let inQ = false
      for (let i=0;i<line.length;i++){
        const ch = line[i]
        if (ch === '"') {
          if (inQ && line[i+1] === '"') { cur += '"'; i++; }
          else { inQ = !inQ }
        } else if (ch === ',' && !inQ) { out.push(cur); cur = '' }
        else { cur += ch }
      }
      out.push(cur)
      return out.map(s => s.replace(/^"|"$/g,'').trim())
    }
    const headers = split(lines[0])
    const rows = lines.slice(1).map(l => {
      const parts = split(l)
      const obj: Record<string,string> = {}
      headers.forEach((h, idx) => obj[h] = parts[idx] ?? '')
      return obj
    })
    return { headers, rows }
  }

  const handleRestore = async () => {
    if (!restoreFile) return
    const text = await restoreFile.text()
    const { rows } = parseCsv(text)
    if (rows.length === 0) return
    // Upsert in small batches
    const batch = 500
    for (let i=0;i<rows.length;i+=batch){
      const chunk = rows.slice(i, i+batch)
      await supabase.from(restoreTable as any).upsert(chunk, { onConflict: undefined })
    }
    alert('Restore completed for table ' + restoreTable)
  }

  if (!['super_admin','admin'].includes(userRole || '')) {
    return (
      <div className='p-6'>
        <Card className='max-w-md mx-auto'>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Only Admins and Super Admins can manage backups.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (loading) return <div className='p-6'>Loading...</div>

  return (
    <div className='p-2 sm:p-4 md:p-6'>
      <Card>
        <CardHeader className='flex items-center justify-between'>
          <div>
            <CardTitle>Backups</CardTitle>
            <CardDescription>Nightly or on-demand CSV snapshots to the backups bucket (30-day retention).</CardDescription>
          </div>
          <Button onClick={runBackup} disabled={running}>{running ? 'Running...' : 'Run Backup Now'}</Button>
        </CardHeader>
        <CardContent>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr>
                  <th className='text-left p-2'>When</th>
                  <th className='text-left p-2'>Path</th>
                  <th className='text-left p-2'>Objects</th>
                  <th className='text-left p-2'>Size</th>
                  <th className='text-left p-2'>Status</th>
                  <th className='text-left p-2'>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className='border-t'>
                    <td className='p-2'>{new Date(r.created_at).toLocaleString()}</td>
                    <td className='p-2'>{r.path}</td>
                    <td className='p-2'>{r.object_count}</td>
                    <td className='p-2'>{r.total_size_bytes ? `${(r.total_size_bytes/1024/1024).toFixed(2)} MB` : '-'}</td>
                    <td className='p-2'>{r.status}</td>
                    <td className='p-2'>
                      <Button variant='outline' size='sm' onClick={() => openFiles(r.path)}>View Files</Button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td className='p-2 text-muted-foreground' colSpan={5}>No backups yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {expandedPath && (
            <div className='mt-6'>
              <div className='flex items-center justify-between'>
                <h3 className='font-semibold'>Files in {expandedPath}</h3>
                <Button variant='outline' size='sm' onClick={() => setExpandedPath(null)}>Close</Button>
              </div>
              <div className='overflow-x-auto mt-2'>
                <table className='w-full text-sm'>
                  <thead>
                    <tr>
                      <th className='text-left p-2'>File</th>
                      <th className='text-left p-2'>Size</th>
                      <th className='text-left p-2'>Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map(f => (
                      <tr key={f.name} className='border-t'>
                        <td className='p-2'>{f.name}</td>
                        <td className='p-2'>{f.size ? `${(f.size/1024).toFixed(1)} KB` : '-'}</td>
                        <td className='p-2'>
                          <Button variant='outline' size='sm' onClick={() => downloadFile(expandedPath, f.name)}>Download</Button>
                        </td>
                      </tr>
                    ))}
                    {files.length === 0 && (
                      <tr><td className='p-2 text-muted-foreground' colSpan={3}>No files found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className='mt-8'>
            <h3 className='font-semibold mb-2'>Restore from CSV</h3>
            <div className='flex items-center gap-2 mb-2'>
              <select value={restoreTable} onChange={(e) => setRestoreTable(e.target.value)} className='border rounded px-2 py-1 text-sm'>
                <option value='members'>members</option>
                <option value='loans'>loans</option>
                <option value='loan_payments'>loan_payments</option>
                <option value='groups'>groups</option>
                <option value='branches'>branches</option>
                <option value='profiles'>profiles</option>
                <option value='expenses'>expenses</option>
              </select>
              <input type='file' accept='.csv' onChange={(e) => setRestoreFile(e.target.files?.[0] || null)} className='text-sm' />
              <Button variant='outline' size='sm' onClick={handleRestore} disabled={!restoreFile}>Import</Button>
            </div>
            <p className='text-xs text-muted-foreground'>Tip: Use CSVs exported by this system for best compatibility. Large imports are processed in batches.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Backups


