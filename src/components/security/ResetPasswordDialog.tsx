import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Loader2, Check, ChevronsUpDown, Eye, EyeOff } from 'lucide-react';

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
  mode?: 'admin' | 'self';
  selfUser?: { id: string; full_name?: string | null; email?: string | null } | null;
}
type UserSearchResult = { id: string; full_name: string; email: string; };

export const ResetPasswordDialog: React.FC<ResetPasswordDialogProps> = ({ open, onOpenChange, mode = 'admin', selfUser = null }) => {
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [users, setUsers] = useState<UserSearchResult[]>([]);
    const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // Preselect current user in self mode
        if (mode === 'self' && selfUser?.id) {
            setSelectedUser({ id: selfUser.id, full_name: selfUser.full_name || 'You', email: selfUser.email || '' });
        }
    }, [mode, selfUser]);

    useEffect(() => {
        if (!popoverOpen) return;
        if (mode === 'self') return; // no search in self mode
        const searchUsers = async () => {
            const { data } = await supabase.from('profiles').select('id, full_name, email').ilike('full_name', `%${searchTerm}%`).limit(5);
            setUsers(data || []);
        };
        const timeoutId = setTimeout(() => searchUsers(), 300);
        return () => clearTimeout(timeoutId);
    }, [searchTerm, popoverOpen]);

    const handleSubmit = async () => {
        if (!selectedUser || !newPassword) {
            toast.warning("Please select a user and enter a new password.");
            return;
        }
        if (newPassword.length < 6) {
            toast.warning("Password must be at least 6 characters long.");
            return;
        }
        setIsSubmitting(true);
        try {
            if (mode === 'self') {
                const { error } = await supabase.auth.updateUser({ password: newPassword });
                if (error) throw error;
                toast.success("Password changed", { description: "Your password has been updated." });
            } else {
                const response = await supabase.functions.invoke('reset-user-password', {
                    body: { userId: selectedUser.id, newPassword: newPassword }
                });
                if (response.error) throw new Error(response.error.message);
                if (!response.data.success) throw new Error(response.data.error);
                toast.success("Password Reset Successful", { description: `The password for ${selectedUser.full_name} has been changed.` });
            }
            resetState();
            onOpenChange(false);
        } catch (error: any) {
            toast.error("Failed to reset password", { description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const resetState = () => {
        setSearchTerm('');
        setSelectedUser(null);
        setNewPassword('');
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{mode === 'self' ? 'Change Your Password' : 'Reset User Password'}</DialogTitle>
                    <DialogDescription>
                        {mode === 'self' ? 'Set a new password for your account.' : 'Search for a user and provide a new temporary password for their account.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {mode === 'admin' ? (
                        <>
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
                                                    {user.full_name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </>
                    ) : (
                        <div>
                            <Label>User</Label>
                            <div className="p-2 border rounded text-sm">{selfUser?.full_name || 'You'} ({selfUser?.email || ''})</div>
                        </div>
                    )}
                    <div>
                        <Label>New Password</Label>
                        <div className="relative">
                            <Input 
                                type={showPassword ? "text" : "password"} 
                                value={newPassword} 
                                onChange={e => setNewPassword(e.target.value)} 
                                placeholder="Minimum 6 characters" 
                            />
                            {/* --- THE CRITICAL FIX --- */}
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" 
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !selectedUser}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {mode === 'self' ? 'Change Password' : 'Set New Password'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};