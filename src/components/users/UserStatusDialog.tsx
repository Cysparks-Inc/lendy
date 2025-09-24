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
import { AlertTriangle, CheckCircle, XCircle, UserX } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UserStatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    branch_name?: string;
    is_active: boolean;
  };
  onStatusChanged: () => void;
}

export const UserStatusDialog: React.FC<UserStatusDialogProps> = ({
  isOpen,
  onClose,
  user,
  onStatusChanged,
}) => {
  const { user: currentUser, userRole } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);

  const canManageUsers = userRole === 'super_admin' || 
    (userRole === 'branch_admin' && ['loan_officer', 'auditor'].includes(user.role));

  const handleStatusChange = async () => {
    if (!currentUser || !canManageUsers) {
      toast.error('Access Denied', {
        description: 'You do not have permission to change user status.',
      });
      return;
    }

    // Prevent self-deactivation
    if (user.id === currentUser.id) {
      toast.error('Cannot Deactivate Yourself', {
        description: 'You cannot deactivate your own account.',
      });
      return;
    }

    try {
      setIsUpdating(true);

      // For now, we'll simulate the status change by updating the profiles table directly
      // In a production system, you'd want proper user management functions
      const { error } = await supabase
        .from('profiles')
        .update({ 
          is_active: !user.is_active,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      const action = user.is_active ? 'deactivated' : 'activated';
      toast.success(`User ${action}`, {
        description: `${user.full_name} has been ${action} successfully.`,
      });

      onStatusChanged();
      onClose();
    } catch (error: any) {
      console.error('Error changing user status:', error);
      toast.error('Failed to Change User Status', {
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (!canManageUsers) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {user.is_active ? (
              <>
                <UserX className="h-5 w-5 text-orange-500" />
                Deactivate User
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                Activate User
              </>
            )}
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              {user.is_active
                ? 'Are you sure you want to deactivate this user? Inactive users will not be able to login to the system.'
                : 'Are you sure you want to activate this user? They will be able to login again.'}
            </p>
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm font-medium">User Details:</p>
              <p className="text-sm">Name: {user.full_name}</p>
              <p className="text-sm">Email: {user.email}</p>
              <p className="text-sm">Role: {user.role}</p>
              {user.branch_name && <p className="text-sm">Branch: {user.branch_name}</p>}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm">Status:</span>
                <Badge variant={user.is_active ? 'default' : 'secondary'}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
            {user.is_active && (
              <div className="bg-orange-50 border border-orange-200 p-3 rounded-md">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                  <div className="text-sm text-orange-800">
                    <p className="font-medium">Warning:</p>
                    <p>Deactivating this user will prevent them from logging in. They will lose access to all system features immediately.</p>
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
            variant={user.is_active ? 'destructive' : 'default'}
            onClick={handleStatusChange}
            disabled={isUpdating || user.id === currentUser?.id}
            className="gap-2"
          >
            {user.is_active ? (
              <>
                <UserX className="h-4 w-4" />
                {isUpdating ? 'Deactivating...' : 'Deactivate User'}
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                {isUpdating ? 'Activating...' : 'Activate User'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
