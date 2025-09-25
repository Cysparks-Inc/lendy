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
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GroupDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  group: {
    id: number;
    name: string;
    code?: string;
    branch_name?: string;
    member_count: number;
  };
  onGroupDeleted: () => void;
}

export const GroupDeleteDialog: React.FC<GroupDeleteDialogProps> = ({
  isOpen,
  onClose,
  group,
  onGroupDeleted,
}) => {
  const { user, userRole } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);

  const canDeleteGroup = userRole === 'super_admin';

  const handleDeleteGroup = async () => {
    if (!user || !canDeleteGroup) {
      toast.error('Access Denied', {
        description: 'Only super admins can delete groups.',
      });
      return;
    }

    if (group.member_count > 0) {
      toast.error('Cannot Delete Group', {
        description: 'Groups with members cannot be deleted. Please move or remove all members first.',
      });
      return;
    }

    try {
      setIsDeleting(true);

      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', group.id);

      if (error) {
        throw error;
      }

      toast.success('Group deleted', {
        description: `Group ${group.name} has been deleted successfully.`,
      });

      onGroupDeleted();
      onClose();
    } catch (error: any) {
      console.error('Error deleting group:', error);
      toast.error('Failed to Delete Group', {
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!canDeleteGroup) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-500" />
            Delete Group
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              Are you sure you want to delete this group? This action cannot be undone.
            </p>
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm font-medium">Group Details:</p>
              <p className="text-sm">Name: {group.name}</p>
              {group.code && <p className="text-sm">Code: {group.code}</p>}
              {group.branch_name && <p className="text-sm">Branch: {group.branch_name}</p>}
              <p className="text-sm">Members: {group.member_count}</p>
            </div>
            {group.member_count > 0 && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-md">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium">Cannot Delete:</p>
                    <p>This group has {group.member_count} member(s). Please remove all members before deleting the group.</p>
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
            onClick={handleDeleteGroup}
            disabled={isDeleting || group.member_count > 0}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? 'Deleting...' : 'Delete Group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};