import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Loader2, Check, ChevronsUpDown, Shield, AlertTriangle } from 'lucide-react';

interface DisableMfaDialogProps {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

type UserSearchResult = { 
  id: string; 
  full_name: string; 
  email: string; 
};

export const DisableMfaDialog: React.FC<DisableMfaDialogProps> = ({ open, onOpenChange }) => {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!popoverOpen) return;
    const searchUsers = async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, email').ilike('full_name', `%${searchTerm}%`).limit(10);
      setUsers(data || []);
    };
    const timeoutId = setTimeout(() => searchUsers(), 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, popoverOpen]);

  const handleDisableMfa = async () => {
    if (!selectedUser) {
      toast.warning("Please select a user.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Call edge function to remove factors
      const { data, error } = await supabase.functions.invoke('disable-user-mfa', {
        body: { userId: selectedUser.id }
      });
      if (error) throw error;

      // Clear any local MFA verified flags for this user as well
      localStorage.removeItem(`mfa_verified_${selectedUser.id}`);

      toast.success("MFA Disabled", { 
        description: `Removed ${data?.removed ?? 0} factor(s) for ${selectedUser.full_name}. They can re-enroll on next login.` 
      });
      resetState();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Failed to disable MFA", { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const resetState = () => {
    setSearchTerm('');
    setSelectedUser(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Clear User MFA Access
          </DialogTitle>
          <DialogDescription>
            Clear MFA verification for a user so they can re-enroll on their next login.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Search User</Label>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between">
                  {selectedUser ? `${selectedUser.full_name} (${selectedUser.email})` : "Select a user..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Search user by name..." onValueChange={setSearchTerm} />
                  <CommandEmpty>No users found.</CommandEmpty>
                  <CommandGroup>
                    {users.map((user) => (
                      <CommandItem key={user.id} onSelect={() => { setSelectedUser(user); setPopoverOpen(false); }}>
                        <Check className={`mr-2 h-4 w-4 ${selectedUser?.id === user.id ? "opacity-100" : "opacity-0"}`} />
                        <div className="flex flex-col">
                          <span>{user.full_name}</span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selectedUser && (
            <div className="p-3 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4" />
                <span className="font-medium">Clear MFA for {selectedUser.full_name}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                This will clear their MFA verification status. They will be prompted to re-enroll on next login.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handleDisableMfa} 
            disabled={isSubmitting || !selectedUser}
            variant="destructive"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Clear MFA Access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
