import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, Phone, UserPlus, Mail, Calendar, Clock, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface CommunicationLog {
  id: string;
  member_id: string;
  loan_id: string;
  officer_id: string;
  communication_type: string;
  notes: string;
  follow_up_date: string | null;
  follow_up_notes: string | null;
  created_at: string;
  updated_at: string;
  member_name: string;
  branch_name: string;
  officer_name: string;
  officer_role: string;
}

interface CommunicationLogsProps {
  loanId: string | null;
  memberId: string | null;
  memberName: string;
  onRefresh?: () => void;
  key?: number; // Add key for forcing refresh
}

const getCommunicationTypeIcon = (type: string) => {
  switch (type) {
    case 'Call': return Phone;
    case 'SMS': return MessageSquare;
    case 'Email': return Mail;
    case 'Visit': return UserPlus;
    case 'Meeting': return UserPlus;
    default: return MessageSquare;
  }
};

const getCommunicationTypeColor = (type: string) => {
  switch (type) {
    case 'Call': return 'bg-blue-100 text-blue-800';
    case 'SMS': return 'bg-green-100 text-green-800';
    case 'Email': return 'bg-purple-100 text-purple-800';
    case 'Visit': return 'bg-orange-100 text-orange-800';
    case 'Meeting': return 'bg-indigo-100 text-indigo-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const CommunicationLogs: React.FC<CommunicationLogsProps> = ({ 
  loanId, 
  memberId, 
  memberName,
  onRefresh 
}) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLog, setEditingLog] = useState<CommunicationLog | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editType, setEditType] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editFollowUpDate, setEditFollowUpDate] = useState('');
  const [editFollowUpNotes, setEditFollowUpNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tableExists, setTableExists] = useState<boolean | null>(null); // Track if table exists

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Use direct query with profiles join to get officer names
      const query = supabase
        .from('communication_logs')
        .select(`
          *,
          profiles!communication_logs_officer_id_fkey(full_name)
        `);
      
      // If we have a loanId, filter by loan_id
      if (loanId) {
        query.eq('loan_id', loanId);
      }
      
      // If we have a memberId, filter by member_id
      if (memberId) {
        query.eq('member_id', memberId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) {
        // Check if it's a table doesn't exist error
        if (error.message?.includes('relation "communication_logs" does not exist')) {
          toast.error('Communication logs table not found. Please contact an administrator.');
          setLogs([]);
          return;
        }
        throw error;
      }
      
      // Transform the data to match the expected format
      const transformedLogs = (data || []).map(log => {
        // Type assertion to handle the profiles join
        const logData = log as any;
        return {
          id: logData.id,
          member_id: logData.member_id,
          loan_id: logData.loan_id,
          officer_id: logData.officer_id,
          communication_type: logData.communication_type,
          notes: logData.notes,
          follow_up_date: logData.follow_up_date,
          follow_up_notes: logData.follow_up_notes,
          created_at: logData.created_at,
          updated_at: logData.updated_at,
          member_name: memberName || 'Unknown Member',
          branch_name: 'Unknown Branch', // We'll get this from the parent component
          officer_name: logData.profiles?.full_name || 'Unknown Officer',
          officer_role: 'Unknown Role' // We don't have role info from profiles
        };
      });
      
      setLogs(transformedLogs);
    } catch (error: any) {
      console.error("Failed to fetch communication logs:", error.message);
      toast.error(`Failed to fetch communication logs: ${error.message}`);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // Check if the communication_logs table exists
  const checkTableExists = async () => {
    try {
      const { data, error } = await supabase
        .from('communication_logs')
        .select('id')
        .limit(1);
      
      if (error) {
        if (error.message?.includes('relation "communication_logs" does not exist')) {
          setTableExists(false);
          return;
        }
        throw error;
      }
      
      setTableExists(true);
    } catch (error: any) {
      setTableExists(false);
    }
  };

  useEffect(() => {
    // Check if table exists first
    checkTableExists();
  }, []);

  useEffect(() => {
    // Fetch logs if we have either a loanId or memberId and table exists
    if ((loanId || memberId) && tableExists === true) {
      fetchLogs();
    }
  }, [loanId, memberId, tableExists]);

  const handleRefresh = () => {
    fetchLogs();
    if (onRefresh) onRefresh();
  };

  // Remove the problematic useEffect that was causing infinite loops

  const canEditLog = (log: CommunicationLog) => {
    if (!user) return false;
    // Super admin can edit all logs
    if (user.role === 'super_admin') return true;
    // Branch admin can edit logs in their branch (simplified for now)
    if (user.role === 'branch_admin') return true;
    // User can edit their own logs
    return log.officer_id === user.id;
  };

  const canDeleteLog = (log: CommunicationLog) => {
    const canDelete = canEditLog(log);
    return canDelete;
  };

  const handleEdit = (log: CommunicationLog) => {
    setEditingLog(log);
    setEditType(log.communication_type);
    setEditNotes(log.notes);
    setEditFollowUpDate(log.follow_up_date || '');
    setEditFollowUpNotes(log.follow_up_notes || '');
    setIsEditDialogOpen(true);
  };

  const handleDelete = async (log: CommunicationLog) => {
    if (!confirm('Are you sure you want to delete this communication log? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('communication_logs')
        .delete()
        .eq('id', log.id);

      if (error) {
        console.error('Delete error:', error);
        throw error;
      }
      
      toast.success('Communication log deleted successfully');
      fetchLogs(); // Refresh the list
    } catch (error: any) {
      console.error('Failed to delete communication log:', error);
      toast.error(`Failed to delete communication log: ${error.message}`);
    }
  };

  const handleEditSubmit = async () => {
    if (!editingLog || !editType || !editNotes) {
      toast.warning('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('communication_logs')
        .update({
          communication_type: editType,
          notes: editNotes,
          follow_up_date: editFollowUpDate || null,
          follow_up_notes: editFollowUpNotes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingLog.id);

      if (error) throw error;
      
      toast.success('Communication log updated successfully');
      setIsEditDialogOpen(false);
      setEditingLog(null);
      fetchLogs(); // Refresh the list
    } catch (error: any) {
      console.error('Failed to update communication log:', error);
      toast.error('Failed to update communication log');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-KE', { 
      dateStyle: 'medium', 
      timeStyle: 'short' 
    });
  };

  const formatDateOnly = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-KE');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Communication History</CardTitle>
          <CardDescription>Loading communication logs...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show message if table doesn't exist
  if (tableExists === false) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Communication History</CardTitle>
          <CardDescription>Communication logs system not available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              The communication logs table has not been set up yet.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Please run the database migration to create the communication_logs table.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Contact your system administrator for assistance.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {loanId ? 'All Communications & Follow-ups' : 'Communication History'}
              </CardTitle>
              <CardDescription>
                {loanId 
                  ? `Complete communication history including calls, SMS, emails, visits, meetings, and follow-up activities for ${memberName}'s loan.`
                  : `Complete communication history including calls, SMS, emails, visits, meetings, and follow-up activities for ${memberName}.`
                }
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <Clock className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-10">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {loanId 
                  ? 'No communications or follow-ups have been logged for this loan yet.'
                  : 'No communications or follow-ups have been logged for this member yet.'
                }
              </p>
              <p className="text-sm text-muted-foreground mt-2">Click "Log Communication" to add the first entry.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {logs.map(log => {
                const IconComponent = getCommunicationTypeIcon(log.communication_type);
                const badgeColor = getCommunicationTypeColor(log.communication_type);
                
                return (
                  <div key={log.id} className="p-4 rounded-lg border bg-muted/50">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${badgeColor}`}>
                          <IconComponent className="h-4 w-4" />
                        </div>
                        <div>
                          <Badge variant="outline" className={badgeColor}>
                            {log.communication_type}
                          </Badge>
                          <p className="text-sm font-medium mt-1">
                            {log.officer_name || 'Unknown Officer'}
                            {log.officer_role && (
                              <span className="text-xs text-muted-foreground ml-2">
                                ({log.officer_role})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {formatDate(log.created_at)}
                        </p>
                        {log.branch_name && (
                          <p className="text-xs text-muted-foreground">
                            {log.branch_name}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm">{log.notes}</p>
                      
                      {log.follow_up_date && (
                        <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 p-2 rounded">
                          <Calendar className="h-3 w-3" />
                          <span className="font-medium">Follow-up: {formatDateOnly(log.follow_up_date)}</span>
                          {log.follow_up_notes && (
                            <span className="text-blue-700">- {log.follow_up_notes}</span>
                          )}
                        </div>
                      )}
                      
                      {/* Action buttons for edit/delete */}
                      {(canEditLog(log) || canDeleteLog(log)) && (
                        <div className="flex gap-2 pt-2 border-t border-muted">
                          {canEditLog(log) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(log)}
                              className="h-7 px-2 text-xs"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                          )}
                          {canDeleteLog(log) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(log)}
                              className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Communication Log Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Communication Log</DialogTitle>
            <DialogDescription>Update the communication details for {memberName}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Communication Type</Label>
              <Select onValueChange={setEditType} value={editType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Call">Phone Call</SelectItem>
                  <SelectItem value="SMS">SMS</SelectItem>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="Visit">Field Visit</SelectItem>
                  <SelectItem value="Meeting">Meeting</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes / Summary</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Update the communication notes..."
                rows={3}
              />
            </div>
            <div>
              <Label>Follow-up Date (Optional)</Label>
              <Input
                type="date"
                value={editFollowUpDate}
                onChange={(e) => setEditFollowUpDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Follow-up Notes (Optional)</Label>
              <Textarea
                value={editFollowUpNotes}
                onChange={(e) => setEditFollowUpNotes(e.target.value)}
                placeholder="Any follow-up actions or notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Log'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
