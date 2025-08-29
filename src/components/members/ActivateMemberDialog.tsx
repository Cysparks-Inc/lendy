import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, DollarSign, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DormantMember {
  id: string;
  full_name: string;
  id_number: string;
  phone_number: string;
  branch_name?: string;
  last_activity_date: string;
  months_inactive: number;
  status: string;
  activation_fee_paid: boolean;
}

interface ActivateMemberDialogProps {
  member: DormantMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const ActivateMemberDialog: React.FC<ActivateMemberDialogProps> = ({
  member,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!paymentMethod) {
      toast.error('Please select a payment method');
      return;
    }

    setIsSubmitting(true);
    try {
      // Update member to mark activation fee as paid using the database function
      const { error: updateError } = await supabase
        .rpc('activate_dormant_member', { member_uuid: member.id });

      if (updateError) throw updateError;

      // Create a transaction record for the activation fee
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          transaction_type: 'fee',
          amount: 500,
          currency: 'KES',
          status: 'completed',
          payment_method: paymentMethod,
          reference_number: `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          description: `Member Activation Fee - ${member.full_name}`,
          transaction_date: new Date().toISOString(),
          member_id: member.id,
          fees: 500,
          total_paid: 500,
          notes: notes || 'Member activation fee payment',
          created_by: user?.id,
        });

      if (transactionError) throw transactionError;

      toast.success('Member activated successfully!', {
        description: `KES 500 activation fee collected from ${member.full_name}`
      });

      onSuccess();
    } catch (error: any) {
      console.error('Error activating member:', error);
      toast.error('Failed to activate member', { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => 
    new Date(dateString).toLocaleDateString('en-KE');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Activate Member
          </DialogTitle>
          <DialogDescription>
            Collect the KES 500 activation fee to reactivate {member.full_name} from dormant status.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Member Information */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Member Details</h4>
            <div className="space-y-2 text-sm">
              <div><span className="font-medium">Name:</span> {member.full_name}</div>
              <div><span className="font-medium">ID:</span> {member.id_number}</div>
              <div><span className="font-medium">Phone:</span> {member.phone_number}</div>
              <div><span className="font-medium">Branch:</span> {member.branch_name || 'N/A'}</div>
              <div><span className="font-medium">Last Active:</span> {formatDate(member.last_activity_date)}</div>
              <div><span className="font-medium">Inactive For:</span> {member.months_inactive} months</div>
            </div>
          </div>

          {/* Activation Fee Display */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-center">
              <div className="text-sm text-green-600 font-medium">Activation Fee</div>
              <div className="text-2xl font-bold text-green-800">KES 500</div>
              <div className="text-xs text-green-700 mt-1">
                This fee is required to reactivate the member and allow new loans
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label htmlFor="payment_method">Payment Method *</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Input
              id="notes"
              placeholder="e.g., Payment received at branch office"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Warning */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Once activated, this member will be able to apply for new loans. 
              The activation fee will be recorded in the income system.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <DollarSign className="mr-2 h-4 w-4" />
              Collect Fee & Activate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
