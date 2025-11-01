import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Trash2, UserX, Ban } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MemberDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  member: {
    id: string;
    full_name: string;
    phone_number: string;
    status: string;
  };
  onMemberDeleted: () => void;
}

export const MemberDeleteDialog: React.FC<MemberDeleteDialogProps> = ({
  isOpen,
  onClose,
  member,
  onMemberDeleted,
}) => {
  const { user, userRole } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isContactPerson, setIsContactPerson] = useState(false);
  const [contactGroups, setContactGroups] = useState<any[]>([]);
  const [showContactPersonWarning, setShowContactPersonWarning] = useState(false);
  const [hasLoans, setHasLoans] = useState(false);
  const [loanCount, setLoanCount] = useState(0);

  const canDeleteMember = userRole === 'super_admin' || userRole === 'branch_admin';

  useEffect(() => {
    if (isOpen && member.id) {
      checkContactPersonStatus();
      checkLoansStatus();
    }
  }, [isOpen, member.id]);

  const checkContactPersonStatus = async () => {
    try {
      const { data: groups, error } = await (supabase as any)
        .from('groups')
        .select('id, name')
        .eq('contact_person_id', member.id);

      if (error) throw error;

      if (groups && groups.length > 0) {
        setIsContactPerson(true);
        setContactGroups(groups);
        setShowContactPersonWarning(true);
      } else {
        setIsContactPerson(false);
        setContactGroups([]);
        setShowContactPersonWarning(false);
      }
    } catch (error) {
    }
  };

  const checkLoansStatus = async () => {
    try {
      // Fetch ALL loans (including soft-deleted) since foreign key constraints apply regardless
      const { data: allLoans, error } = await supabase
        .from('loans')
        .select('id, status, is_deleted')
        .eq('member_id', member.id);

      if (error) throw error;

      // Filter out soft-deleted loans for checking
      const nonDeletedLoans = (allLoans || []).filter(
        loan => loan.is_deleted === false || loan.is_deleted === null
      );
      
      // Filter out repaid and completed loans - only active/pending/etc should block deletion
      const activeLoans = nonDeletedLoans.filter(
        loan => loan.status !== 'repaid' && loan.status !== 'completed'
      );

      // Check if there are any active loans (these will block deletion)
      if (activeLoans && activeLoans.length > 0) {
        setHasLoans(true);
        setLoanCount(activeLoans.length);
      } else {
        // Has repaid/completed loans or no loans - deletion should work (will auto-delete repaid loans)
        setHasLoans(false);
        setLoanCount(0);
      }
    } catch (error) {
      // On error, assume they might have loans to be safe
      setHasLoans(true);
    }
  };

  const handleDeleteMember = async () => {
    if (!user || !canDeleteMember) {
      toast.error('Access Denied', {
        description: 'You do not have permission to delete members.',
      });
      return;
    }

    // Prevent deletion if member has loans
    if (hasLoans) {
      toast.error('Cannot Delete Member', {
        description: `This member has ${loanCount} active loan(s). Please delete or close all loans before deleting the member.`,
      });
      return;
    }

    try {
      setIsDeleting(true);

      // First, check for ALL loans (including repaid/completed) that might block deletion
      // Also check soft-deleted loans as they might still have foreign key constraints
      const { data: allLoans, error: loansCheckError } = await supabase
        .from('loans')
        .select('id, status, is_deleted')
        .eq('member_id', member.id);

      if (loansCheckError) {
      }


      // Separate active and repaid/completed loans (including soft-deleted ones)
      // We need to handle ALL loans because foreign key constraints apply regardless of is_deleted flag
      const activeLoans = (allLoans || []).filter(
        loan => (loan.is_deleted === false || loan.is_deleted === null) && 
                loan.status !== 'repaid' && loan.status !== 'completed'
      );
      const repaidLoans = (allLoans || []).filter(
        loan => loan.status === 'repaid' || loan.status === 'completed'
      );
      

      // Block if there are active loans
      if (activeLoans.length > 0) {
        toast.error('Cannot Delete Member', {
          description: `This member has ${activeLoans.length} active loan(s). Please delete or close all loans before deleting the member.`,
        });
        setIsDeleting(false);
        return;
      }

      // Delete repaid/completed loans first to avoid foreign key constraint
      // This includes soft-deleted loans which still have foreign key constraints
      if (repaidLoans.length > 0) {
        const repaidLoanIds = repaidLoans.map(loan => loan.id);
        
        // Delete loans one by one to handle all dependencies properly
        const deletionResults = [];
        for (const loanId of repaidLoanIds) {
          try {
            // Step 1: Delete or update realizable_assets
            const { error: assetsDeleteError } = await supabase.from('realizable_assets').delete().eq('loan_id', loanId);
            if (assetsDeleteError) {
              // If deletion fails, try to set loan_id to null
              await supabase.from('realizable_assets').update({ loan_id: null }).eq('loan_id', loanId);
            }
            
            // Step 2: Delete loan_installments (CASCADE should handle, but explicit for clarity)
            await supabase.from('loan_installments').delete().eq('loan_id', loanId);
            
            // Step 3: Delete loan_payments (CASCADE should handle, but explicit for clarity)
            await supabase.from('loan_payments').delete().eq('loan_id', loanId);
            
            // Step 4: Delete communication_logs (CASCADE should handle, but explicit for clarity)
            await supabase.from('communication_logs').delete().eq('loan_id', loanId);
            
            // Step 5: Update transactions to set loan_id to null (SET NULL should handle, but explicit)
            await supabase.from('transactions').update({ loan_id: null }).eq('loan_id', loanId);
            
            // Step 6: Now delete the loan itself
            const { error: loanDeleteError } = await supabase
              .from('loans')
              .delete()
              .eq('id', loanId);
            
            if (loanDeleteError) {
              deletionResults.push({ loanId, error: loanDeleteError });
            } else {
              deletionResults.push({ loanId, success: true });
            }
          } catch (error: any) {
            deletionResults.push({ loanId, error });
          }
        }
        
        // Check if any deletions failed
        const failedDeletions = deletionResults.filter(r => r.error);
        if (failedDeletions.length > 0) {
          const errorMessages = failedDeletions.map(f => f.error?.message || 'Unknown error').join('; ');
          toast.error('Cannot Delete Member', {
            description: `Unable to delete ${failedDeletions.length} of ${repaidLoanIds.length} repaid loan(s). Errors: ${errorMessages}`,
          });
          setIsDeleting(false);
          return;
        }

        // Wait for database to process deletions
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Verify all loans are deleted
        const { data: verifyLoans } = await supabase
          .from('loans')
          .select('id')
          .eq('member_id', member.id)
          .in('id', repaidLoanIds);

        if (verifyLoans && verifyLoans.length > 0) {
          toast.error('Cannot Delete Member', {
            description: `${verifyLoans.length} repaid loan(s) still exist after deletion attempt. The loans may have dependencies that prevent deletion. Please contact an administrator.`,
          });
          setIsDeleting(false);
          return;
        }
      }

      // Final verification before member deletion - check ALL loans (including soft-deleted)
      const { data: finalLoansCheck } = await supabase
        .from('loans')
        .select('id, status, is_deleted')
        .eq('member_id', member.id);
      
      if (finalLoansCheck && finalLoansCheck.length > 0) {
        // Try one more time to delete any remaining loans individually
        const remainingLoanIds = finalLoansCheck.map(loan => loan.id);
        let allDeleted = true;
        
        for (const loanId of remainingLoanIds) {
          // Handle all dependencies again
          const { error: assetsDeleteError } = await supabase.from('realizable_assets').delete().eq('loan_id', loanId);
          if (assetsDeleteError) {
            await supabase.from('realizable_assets').update({ loan_id: null }).eq('loan_id', loanId);
          }
          
          await supabase.from('loan_installments').delete().eq('loan_id', loanId);
          await supabase.from('loan_payments').delete().eq('loan_id', loanId);
          await supabase.from('communication_logs').delete().eq('loan_id', loanId);
          await supabase.from('transactions').update({ loan_id: null }).eq('loan_id', loanId);
          
          const { error: finalDeleteError } = await supabase
            .from('loans')
            .delete()
            .eq('id', loanId);
          
          if (finalDeleteError) {
            allDeleted = false;
          }
        }
        
        // Verify again after final attempt
        await new Promise(resolve => setTimeout(resolve, 200));
        const { data: finalVerify } = await supabase
          .from('loans')
          .select('id')
          .eq('member_id', member.id);
        
        if (finalVerify && finalVerify.length > 0) {
          toast.error('Cannot Delete Member', {
            description: `Member still has ${finalVerify.length} loan(s) that could not be removed. This may be due to database constraints or permissions. Please contact an administrator.`,
          });
          setIsDeleting(false);
          return;
        }
      }

      // If member is a contact person, remove them from groups first
      if (isContactPerson && contactGroups.length > 0) {
        for (const group of contactGroups) {
          await (supabase as any)
            .from('groups')
            .update({ contact_person_id: null })
            .eq('id', group.id);
        }
      }

      // Delete the member
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', member.id);

      if (error) {
        throw error;
      }

      toast.success('Member deleted', {
        description: `${member.full_name} has been deleted successfully.${repaidLoans.length > 0 ? ` (Also deleted ${repaidLoans.length} repaid loan(s))` : ''}`,
      });

      onMemberDeleted();
      onClose();
    } catch (error: any) {
      
      // Check if error is related to foreign key constraint
      if (error.message && error.message.includes('foreign key constraint')) {
        // Fetch loans again to give accurate count
        const { data: remainingLoans } = await supabase
          .from('loans')
          .select('id, status')
          .eq('member_id', member.id)
          .eq('is_deleted', false);
        
        const activeRemaining = (remainingLoans || []).filter(
          loan => loan.status !== 'repaid' && loan.status !== 'completed'
        );
        
        if (activeRemaining.length > 0) {
          toast.error('Cannot Delete Member', {
            description: `This member has ${activeRemaining.length} active loan(s). Please delete or close all loans before deleting the member.`,
          });
        } else {
          toast.error('Cannot Delete Member', {
            description: 'This member has associated loans that could not be automatically deleted. Please contact an administrator.',
          });
        }
      } else {
        toast.error('Failed to Delete Member', {
          description: error.message || 'An unexpected error occurred.',
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (!canDeleteMember) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-500" />
            Delete Member
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              Are you sure you want to delete this member? This action cannot be undone.
            </p>
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm font-medium">Member Details:</p>
              <p className="text-sm">Name: {member.full_name}</p>
              <p className="text-sm">Phone: {member.phone_number}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm">Status:</span>
                <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                  {member.status}
                </Badge>
              </div>
            </div>
            
            {hasLoans && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-md">
                <div className="flex items-start gap-2">
                  <Ban className="h-4 w-4 text-red-500 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium">Cannot Delete Member:</p>
                    <p>This member has {loanCount} active loan(s). You must delete or close all loans before deleting this member.</p>
                  </div>
                </div>
              </div>
            )}

            {showContactPersonWarning && contactGroups.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 p-3 rounded-md">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                  <div className="text-sm text-orange-800">
                    <p className="font-medium">Contact Person Warning:</p>
                    <p>This member is set as contact person for the following group(s):</p>
                    <ul className="list-disc list-inside mt-1">
                      {contactGroups.map((group, index) => (
                        <li key={index}>{group.name}</li>
                      ))}
                    </ul>
                    <p className="mt-1">Deleting this member will remove them as contact person from these groups.</p>
                  </div>
                </div>
              </div>
            )}

            {!hasLoans && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-md">
                <div className="flex items-start gap-2">
                  <UserX className="h-4 w-4 text-red-500 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium">Warning:</p>
                    <p>Deleting a member will permanently remove all their data. This action cannot be undone.</p>
                  </div>
                </div>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteMember}
            disabled={isDeleting || hasLoans}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? 'Deleting...' : 'Delete Member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};