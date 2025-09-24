import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DeleteLoanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  loan: {
    id: string;
    account_number: string;
    principal_amount: number;
    member_name?: string;
  };
  onDeleted: () => void;
}

export const DeleteLoanDialog: React.FC<DeleteLoanDialogProps> = ({
  isOpen,
  onClose,
  loan,
  onDeleted,
}) => {
  const { user, userRole } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!user || userRole !== 'super_admin') {
      toast.error('Access Denied', {
        description: 'Only Super Admins can delete loans.',
      });
      return;
    }

    try {
      setIsDeleting(true);

      const { error } = await supabase.rpc('delete_loan' as any, {
        loan_id: loan.id,
        admin_user_id: user.id,
      });

      if (error) {
        throw error;
      }

      toast.success('Loan Deleted', {
        description: `Loan ${loan.account_number} has been permanently deleted.`,
      });

      onDeleted();
      onClose();
    } catch (error: any) {
      console.error('Error deleting loan:', error);
      toast.error('Failed to Delete Loan', {
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (userRole !== 'super_admin') {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Loan
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              Are you sure you want to permanently delete this loan? This action cannot be undone.
            </p>
            <div className="bg-destructive/10 p-3 rounded-md">
              <p className="text-sm font-medium">Loan Details:</p>
              <p className="text-sm">Account: {loan.account_number}</p>
              <p className="text-sm">Amount: KES {loan.principal_amount.toLocaleString()}</p>
              {loan.member_name && (
                <p className="text-sm">Member: {loan.member_name}</p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? 'Deleting...' : 'Delete Loan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
