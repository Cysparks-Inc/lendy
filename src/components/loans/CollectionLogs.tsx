import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, MessageSquare, Phone, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

export const CollectionLogs = ({ loanId }) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // State for the new log form
  const [contactMethod, setContactMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('collection_logs')
        .select('*, officer:profiles(full_name)')
        .eq('loan_id', loanId)
        .order('log_date', { ascending: false });
      
      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Failed to fetch collection logs:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loanId) {
      fetchLogs();
    }
  }, [loanId]);

  const handleAddLog = async (e) => {
    e.preventDefault();
    if (!contactMethod || !notes) {
      toast.warning('Please select a contact method and enter notes.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const newLog = {
        loan_id: loanId,
        officer_id: user.id,
        contact_method: contactMethod,
        notes: notes,
        next_follow_up_date: nextFollowUp || null,
      };

      const { error } = await supabase.from('collection_logs').insert(newLog);
      if (error) throw error;

      toast.success('Collection log added successfully.');
      // Reset form and refresh the log list
      setContactMethod('');
      setNotes('');
      setNextFollowUp('');
      fetchLogs(); // Refresh the list
    } catch (error) {
      toast.error('Failed to add log', { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString) => new Date(dateString).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Add New Log Form */}
      <Card>
        <CardHeader>
          <CardTitle>Add Collection Log</CardTitle>
          <CardDescription>Record a new follow-up activity.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddLog} className="space-y-4">
            <div>
              <Label htmlFor="contact_method">Contact Method</Label>
              <Select onValueChange={setContactMethod} value={contactMethod}>
                <SelectTrigger><SelectValue placeholder="Select method..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Call"><Phone className="inline h-4 w-4 mr-2" />Phone Call</SelectItem>
                  <SelectItem value="Visit"><UserPlus className="inline h-4 w-4 mr-2" />Field Visit</SelectItem>
                  <SelectItem value="SMS"><MessageSquare className="inline h-4 w-4 mr-2" />SMS Sent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" placeholder="e.g., Member promised to pay by Friday..." value={notes} onChange={e => setNotes(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="next_follow_up">Next Follow-up Date (Optional)</Label>
              <Input id="next_follow_up" type="date" value={nextFollowUp} onChange={e => setNextFollowUp(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Log
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Log History */}
      <Card>
        <CardHeader>
          <CardTitle>Activity History</CardTitle>
          <CardDescription>Chronological record of all follow-ups.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : logs.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No collection activities logged yet.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {logs.map(log => (
                <div key={log.id} className="p-3 rounded-md border bg-muted/50">
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-semibold text-sm">{log.officer?.full_name || 'N/A'} via {log.contact_method}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(log.log_date)}</p>
                  </div>
                  <p className="text-sm">{log.notes}</p>
                  {log.next_follow_up_date && (
                    <p className="text-xs mt-2 font-medium text-blue-600">Next Follow-up: {new Date(log.next_follow_up_date).toLocaleDateString('en-KE')}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};