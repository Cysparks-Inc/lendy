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
import { AlertTriangle, Trash2, UserX } from 'lucide-react';
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

  const canDeleteMember = userRole === 'super_admin' || userRole === 'branch_admin';

  useEffect(() => {
    if (isOpen && member.id) {
      checkContactPersonStatus();
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
      console.error('Error checking contact person status:', error);
    }
  };

  const handleDeleteMember = async () => {
    if (!user || !canDeleteMember) {
      toast.error('Access Denied', {
        description: 'You do not have permission to delete members.',
      });
      return;
    }

    try {
      setIsDeleting(true);

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
        description: `${member.full_name} has been deleted successfully.`,
      });

      onMemberDeleted();
      onClose();
    } catch (error: any) {
      console.error('Error deleting member:', error);
      toast.error('Failed to Delete Member', {
        description: error.message || 'An unexpected error occurred.',
      });
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

            <div className="bg-red-50 border border-red-200 p-3 rounded-md">
              <div className="flex items-start gap-2">
                <UserX className="h-4 w-4 text-red-500 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-medium">Warning:</p>
                  <p>Deleting a member will permanently remove all their data. This action cannot be undone.</p>
                </div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteMember}
            disabled={isDeleting}
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