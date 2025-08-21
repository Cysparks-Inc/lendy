import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Phone, MessageSquare, UserPlus, Mail } from 'lucide-react';

interface LogCommunicationDialogProps {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
  member: { id: string; full_name: string };
  onLogSuccess: () => void; // Callback to refresh the parent component
}

const communicationTypes = [
    { value: "Call", label: "Phone Call", icon: Phone },
    { value: "SMS", label: "SMS", icon: MessageSquare },
    { value: "Email", label: "Email", icon: Mail },
    { value: "Visit", label: "Field Visit", icon: UserPlus },
];

export const LogCommunicationDialog: React.FC<LogCommunicationDialogProps> = ({ open, onOpenChange, member, onLogSuccess }) => {
    const { user } = useAuth();
    const [type, setType] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!type || !notes) {
            toast.warning("Please select a communication type and enter notes.");
            return;
        }
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('communication_logs').insert({
                member_id: member.id,
                officer_id: user?.id,
                communication_type: type,
                notes: notes,
            });

            if (error) throw error;
            toast.success("Communication logged successfully!");
            setType('');
            setNotes('');
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
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Log Communication</DialogTitle>
                    <DialogDescription>Record an interaction with {member?.full_name}.</DialogDescription>
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
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Log
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};