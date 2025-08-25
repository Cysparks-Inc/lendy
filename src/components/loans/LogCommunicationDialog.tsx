import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, Phone, MessageSquare, UserPlus, Mail, Calendar } from 'lucide-react';

interface LogCommunicationDialogProps {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
  loanId: string;
  memberId: string;
  memberName: string;
  onLogSuccess: () => void; // Callback to refresh the parent component
}

const communicationTypes = [
    { value: "Call", label: "Phone Call", icon: Phone },
    { value: "SMS", label: "SMS", icon: MessageSquare },
    { value: "Email", label: "Email", icon: Mail },
    { value: "Visit", label: "Field Visit", icon: UserPlus },
    { value: "Meeting", label: "Meeting", icon: UserPlus },
    { value: "Other", label: "Other", icon: UserPlus },
];

export const LogCommunicationDialog: React.FC<LogCommunicationDialogProps> = ({ 
  open, 
  onOpenChange, 
  loanId, 
  memberId, 
  memberName, 
  onLogSuccess 
}) => {
    const { user } = useAuth();
    const [type, setType] = useState('');
    const [notes, setNotes] = useState('');
    const [followUpDate, setFollowUpDate] = useState('');
    const [followUpNotes, setFollowUpNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!type || !notes) {
            toast.warning("Please select a communication type and enter notes.");
            return;
        }
        if (!memberId && !loanId) {
            toast.warning("Either member ID or loan ID is required.");
            return;
        }
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('communication_logs').insert({
                member_id: memberId || null,
                loan_id: loanId || null,
                officer_id: user?.id,
                communication_type: type,
                notes: notes,
                follow_up_date: followUpDate || null,
                follow_up_notes: followUpNotes || null,
            });

            if (error) throw error;
            toast.success("Communication logged successfully!");
            setType('');
            setNotes('');
            setFollowUpDate('');
            setFollowUpNotes('');
            onLogSuccess(); // Trigger refresh
            onOpenChange(false); // Close the dialog
        } catch (error: any) {
            toast.error("Failed to log communication", { description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Log Communication or Follow-up</DialogTitle>
                    <DialogDescription>
                        {loanId 
                          ? `Record any communication or follow-up activity with ${memberName} regarding their loan. This includes calls, SMS, emails, visits, meetings, and follow-up tasks.`
                          : `Record any communication or follow-up activity with ${memberName}. This includes calls, SMS, emails, visits, meetings, and follow-up tasks.`
                        }
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label>Communication Type</Label>
                        <Select onValueChange={setType} value={type}>
                            <SelectTrigger><SelectValue placeholder="Select an interaction type..." /></SelectTrigger>
                            <SelectContent>
                                {communicationTypes.map(t => (
                                    <SelectItem key={t.value} value={t.value}>
                                        <div className="flex items-center gap-2"><t.icon className="h-4 w-4" /> {t.label}</div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Notes / Summary</Label>
                        <Textarea 
                            value={notes} 
                            onChange={e => setNotes(e.target.value)} 
                            placeholder="e.g., Called member, confirmed they will pay by Friday. No issues reported."
                            rows={4}
                        />
                    </div>
                    <div>
                        <Label>Follow-up Date (Optional)</Label>
                        <Input 
                            type="date" 
                            value={followUpDate} 
                            onChange={e => setFollowUpDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                        />
                    </div>
                    <div>
                        <Label>Follow-up Notes (Optional)</Label>
                        <Textarea 
                            value={followUpNotes} 
                            onChange={e => setFollowUpNotes(e.target.value)} 
                            placeholder="e.g., Remind member about payment deadline"
                            rows={2}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Logging...
                            </>
                        ) : (
                            'Log Communication'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
