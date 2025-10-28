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
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BranchStatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
  branch: {
    id: string;
    name: string;
    location: string;
    is_active: boolean;
  };
  onStatusChanged: () => void;
}

export const BranchStatusDialog: React.FC<BranchStatusDialogProps> = ({
  isOpen,
  onClose,
  branch,
  onStatusChanged,
}) => {
  const { user, userRole } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);

  const canManageBranches = userRole === 'super_admin';

  const handleStatusChange = async () => {
    if (!user || !canManageBranches) {
      toast.error('Access Denied', {
        description: 'Only super admins can change branch status.',
      });
      return;
    }

    try {
      setIsUpdating(true);

      // Update branch directly instead of using RPC function
      const updateData = branch.is_active 
        ? { 
            is_active: false, 
            deactivated_at: new Date().toISOString(),
            deactivated_by: user.id
          }
        : { 
            is_active: true, 
            deactivated_at: null,
            deactivated_by: null
          };

      const { error } = await supabase
        .from('branches')
        .update(updateData)
        .eq('id', branch.id);

      if (error) {
        throw error;
      }

      const action = branch.is_active ? 'deactivated' : 'activated';
      toast.success(`Branch ${action}`, {
        description: `Branch ${branch.name} has been ${action} successfully.`,
      });

      onStatusChanged();
      onClose();
    } catch (error: any) {
      console.error('Error changing branch status:', error);
      toast.error('Failed to Change Branch Status', {
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (!canManageBranches) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {branch.is_active ? (
              <>
                <XCircle className="h-5 w-5 text-orange-500" />
                Deactivate Branch
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                Activate Branch
              </>
            )}
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              {branch.is_active
                ? 'Are you sure you want to deactivate this branch? Inactive branches will not be visible to regular users and cannot be selected for new loans or members.'
                : 'Are you sure you want to activate this branch? It will become visible to users again and can be selected for new operations.'}
            </p>
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm font-medium">Branch Details:</p>
              <p className="text-sm">Name: {branch.name}</p>
              <p className="text-sm">Location: {branch.location}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm">Status:</span>
                <Badge variant={branch.is_active ? 'default' : 'secondary'}>
                  {branch.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
            {branch.is_active && (
              <div className="bg-orange-50 border border-orange-200 p-3 rounded-md">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                  <div className="text-sm text-orange-800">
                    <p className="font-medium">Warning:</p>
                    <p>Deactivating this branch will affect all associated groups, members, and loans. This action should be used carefully.</p>
                  </div>
                </div>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isUpdating}>
            Cancel
          </Button>
          <Button
            variant={branch.is_active ? 'destructive' : 'default'}
            onClick={handleStatusChange}
            disabled={isUpdating}
            className="gap-2"
          >
            {branch.is_active ? (
              <>
                <XCircle className="h-4 w-4" />
                {isUpdating ? 'Deactivating...' : 'Deactivate Branch'}
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                {isUpdating ? 'Activating...' : 'Activate Branch'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
