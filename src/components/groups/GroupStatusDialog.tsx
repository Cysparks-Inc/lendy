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

interface GroupStatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
  group: {
    id: number;
    name: string;
    code?: string;
    branch_name?: string;
    is_active: boolean;
  };
  onStatusChanged: () => void;
}

export const GroupStatusDialog: React.FC<GroupStatusDialogProps> = ({
  isOpen,
  onClose,
  group,
  onStatusChanged,
}) => {
  const { user, userRole } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);

  const canManageGroups = userRole === 'super_admin' || userRole === 'branch_admin';

  const handleStatusChange = async () => {
    if (!user || !canManageGroups) {
      toast.error('Access Denied', {
        description: 'Only admins can change group status.',
      });
      return;
    }

    try {
      setIsUpdating(true);

      const functionName = group.is_active ? 'deactivate_group' : 'activate_group';
      const { error } = await supabase.rpc(functionName, {
        group_id: group.id,
        admin_user_id: user.id,
      });

      if (error) {
        throw error;
      }

      const action = group.is_active ? 'deactivated' : 'activated';
      toast.success(`Group ${action}`, {
        description: `Group ${group.name} has been ${action} successfully.`,
      });

      onStatusChanged();
      onClose();
    } catch (error: any) {
      console.error('Error changing group status:', error);
      toast.error('Failed to Change Group Status', {
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (!canManageGroups) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {group.is_active ? (
              <>
                <XCircle className="h-5 w-5 text-orange-500" />
                Deactivate Group
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                Activate Group
              </>
            )}
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              {group.is_active
                ? 'Are you sure you want to deactivate this group? Inactive groups will not be visible to regular users.'
                : 'Are you sure you want to activate this group? It will become visible to users again.'}
            </p>
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm font-medium">Group Details:</p>
              <p className="text-sm">Name: {group.name}</p>
              {group.code && <p className="text-sm">Code: {group.code}</p>}
              {group.branch_name && <p className="text-sm">Branch: {group.branch_name}</p>}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm">Status:</span>
                <Badge variant={group.is_active ? 'default' : 'secondary'}>
                  {group.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isUpdating}>
            Cancel
          </Button>
          <Button
            variant={group.is_active ? 'destructive' : 'default'}
            onClick={handleStatusChange}
            disabled={isUpdating}
            className="gap-2"
          >
            {group.is_active ? (
              <>
                <XCircle className="h-4 w-4" />
                {isUpdating ? 'Deactivating...' : 'Deactivate Group'}
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                {isUpdating ? 'Activating...' : 'Activate Group'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
