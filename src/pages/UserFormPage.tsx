import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft, CheckCircle, UserPlus, Eye, EyeOff } from 'lucide-react';

// --- Zod Validation Schema ---
const userSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().optional(),
  full_name: z.string().min(3, "Full name is required"),
  phone_number: z.string().optional().default(''),
  role: z.string().min(1, "A role must be selected"),
  branch_id: z.string().min(1, "A branch must be assigned"),
}).refine(data => {
    // In edit mode, password is not required. In create mode, it is.
    return !data.password || data.password.length === 0 || data.password.length >= 6;
}, {
    message: "Password must be at least 6 characters",
    path: ["password"],
});

type UserFormData = z.infer<typeof userSchema>;
type Branch = { id: number; name: string; };

const roles = [
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'branch_manager', label: 'Branch Manager' },
    { value: 'loan_officer', label: 'Loan Officer' },
];

const UserFormPage: React.FC = () => {
    const { id: userId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEditMode = Boolean(userId);

    const [branches, setBranches] = useState<Branch[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const { register, handleSubmit, control, reset, formState: { errors } } = useForm<UserFormData>({
        resolver: zodResolver(userSchema),
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoadingData(true);
            try {
                const { data: branchesData } = await supabase.from('branches').select('id, name');
                setBranches(branchesData || []);

                if (isEditMode && userId) {
                    const { data: userData } = await supabase.from('profiles').select('*').eq('id', userId).single();
                    if (userData) {
                        reset({ ...userData, branch_id: String(userData.branch_id), password: '' });
                    }
                }
            } catch (error: any) {
                toast.error("Failed to load data", { description: error.message });
            } finally {
                setLoadingData(false);
            }
        };
        fetchData();
    }, [userId, isEditMode, reset]);

    const onSubmit = async (data: UserFormData) => {
        setIsSubmitting(true);
        setFormError(null);
        try {
            if (isEditMode) {
                // UPDATE user logic
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({
                        full_name: data.full_name,
                        phone_number: data.phone_number,
                        role: data.role,
                        branch_id: Number(data.branch_id)
                    })
                    .eq('id', userId);
                if (profileError) throw profileError;
                
                // Optionally update password if provided
                if (data.password) {
                    // This requires an edge function for security
                    await supabase.functions.invoke('update-user-password', { body: { userId, password: data.password } });
                }
                toast.success("User updated successfully!");
                navigate('/users');

            } else {
                // CREATE user logic
                if (!data.password) {
                    setFormError("Password is required for new users.");
                    setIsSubmitting(false);
                    return;
                }
                const response = await supabase.functions.invoke('create-user', {
                    body: {
                        email: data.email.trim().toLowerCase(),
                        password: data.password,
                        userData: {
                            full_name: data.full_name,
                            phone_number: data.phone_number,
                            role: data.role,
                            branchId: Number(data.branch_id)
                        }
                    }
                });
                if (response.error) throw new Error(response.error.message);
                if (!response.data.success) throw new Error(response.data.error);

                toast.success("User created successfully!");
                navigate('/users');
            }
        } catch (error: any) {
            setFormError(error.message);
            toast.error("Operation Failed", { description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (loadingData) { return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>; }

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <Button asChild variant="outline" size="sm" className="mb-4"><Link to="/users"><ArrowLeft className="mr-2 h-4 w-4" />Back to Users</Link></Button>
            <Card>
                <CardHeader>
                    <CardTitle>{isEditMode ? 'Edit User' : 'Create New User'}</CardTitle>
                    <CardDescription>Manage system user details, roles, and branch assignments.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        {formError && <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>}
                        <FormField label="Full Name" error={errors.full_name} required><Input {...register("full_name")} /></FormField>
                        <FormField label="Email Address" error={errors.email} required><Input type="email" {...register("email")} disabled={isEditMode} /></FormField>
                        <FormField label="Phone Number" error={errors.phone_number}><Input {...register("phone_number")} /></FormField>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField label="Role" error={errors.role} required>
                                <Controller name="role" control={control} render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger><SelectValue placeholder="Select a role..." /></SelectTrigger>
                                        <SelectContent>{roles.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                )} />
                            </FormField>
                            <FormField label="Branch" error={errors.branch_id} required>
                                <Controller name="branch_id" control={control} render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={String(field.value || '')}>
                                        <SelectTrigger><SelectValue placeholder="Assign a branch..." /></SelectTrigger>
                                        <SelectContent>{branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                )} />
                            </FormField>
                        </div>

                        <FormField label={isEditMode ? "New Password (Optional)" : "Password"} error={errors.password} required={!isEditMode}>
                            <div className="relative">
                                <Input type={showPassword ? "text" : "password"} {...register("password")} />
                                <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                        </FormField>

                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isEditMode ? 'Save Changes' : 'Create User'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

const FormField: React.FC<{ label: string; error?: { message?: string }; children: React.ReactNode; required?: boolean; }> = ({ label, error, children, required }) => (
    <div className="space-y-2">
        <Label className="flex items-center">{label}{required && <span className="text-red-500 ml-1">*</span>}</Label>
        {children}
        {error && <p className="text-sm text-red-500 mt-1">{error.message}</p>}
    </div>
);

export default UserFormPage;