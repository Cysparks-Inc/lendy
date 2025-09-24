import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface WriteOffLoanDialogProps {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSuccess: () => void;
}

type DefaultedLoan = { id: string; member_name: string; account_number: string; current_balance: number };

export const WriteOffLoanDialog: React.FC<WriteOffLoanDialogProps> = ({ open, onOpenChange, onSuccess }) => {
    const { user } = useAuth();
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [defaultedLoans, setDefaultedLoans] = useState<DefaultedLoan[]>([]);
    const [selectedLoan, setSelectedLoan] = useState<DefaultedLoan | null>(null);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!open) return;

        const searchLoans = async () => {
            const { data } = await supabase
                .from('loans_with_details' as any)
                .select('id, member_name, account_number, current_balance')
                .eq('status', 'defaulted')
                .ilike('member_name', `%${searchTerm}%`)
                .limit(10);
            setDefaultedLoans((data as any) || []);
        };
        
        const timeoutId = setTimeout(() => searchLoans(), 300);
        return () => clearTimeout(timeoutId);
    }, [searchTerm, open]);

    const handleSubmit = async () => {
        if (!selectedLoan || !notes) {
            toast.warning("Please select a loan and provide a reason for the write-off.");
            return;
        }
        setIsSubmitting(true);
        try {
            // --- THE CRITICAL FIX: Use the new, unambiguous parameter names ---
            const { error } = await supabase.rpc('write_off_loan' as any, {
                loan_uuid: selectedLoan.id,
                requesting_user_uuid: user?.id,
                write_off_notes: notes
            });
            if (error) throw error;
            toast.success("Loan successfully written off as bad debt.");
            onSuccess();
            onOpenChange(false);
            resetState();
        } catch (error: any) {
            toast.error("Failed to write off loan", { description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const resetState = () => {
        setSearchTerm('');
        setSelectedLoan(null);
        setNotes('');
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Write-off a Loan as Bad Debt</DialogTitle>
                    <DialogDescription>Search for a defaulted loan to write it off. This action is permanent.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <Label>Search Defaulted Loan</Label>
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" aria-expanded={popoverOpen} className="w-full justify-between">
                                {selectedLoan ? `${selectedLoan.member_name} (${selectedLoan.account_number})` : "Select a defaulted loan..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                                <CommandInput placeholder="Search member name..." onValueChange={setSearchTerm} />
                                <CommandEmpty>No defaulted loans found.</CommandEmpty>
                                <CommandGroup>
                                    {defaultedLoans.map((loan) => (
                                        <CommandItem key={loan.id} onSelect={() => { setSelectedLoan(loan); setPopoverOpen(false); }}>
                                            <Check className={`mr-2 h-4 w-4 ${selectedLoan?.id === loan.id ? "opacity-100" : "opacity-0"}`} />
                                            {loan.member_name} ({loan.account_number})
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    
                    {selectedLoan && <Card className="bg-gradient-to-br from-brand-green-50 to-brand-green-100 border-brand-green-200">
                      <CardContent className="p-4 text-sm text-brand-green-800">
                        You have selected to write off <strong>{selectedLoan.member_name}'s</strong> loan with a balance of <strong>{new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(selectedLoan.current_balance)}</strong>.
                      </CardContent>
                    </Card>}

                    <div>
                        <Label>Reason for Write-off</Label>
                        <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Provide a clear reason for this action, e.g., 'Member uncontactable for 180+ days, all collection efforts exhausted.'" />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !selectedLoan}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm Write-off
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};