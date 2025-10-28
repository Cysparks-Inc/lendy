import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowLeft } from 'lucide-react';

// --- Validation Schema ---
const assetSchema = z.object({
  asset_type: z.string().min(1, "Asset type is required"),
  description: z.string().min(3, "A clear description is required"),
  branch_id: z.string().min(1, "A branch must be assigned"),
  member_id: z.string().uuid().optional().nullable().or(z.literal('')),
  loan_id: z.string().uuid().optional().nullable().or(z.literal('')),
  current_market_value: z.preprocess(val => Number(val), z.number().min(0)),
  realizable_value: z.preprocess(val => Number(val), z.number().min(0)),
  last_valuation_date: z.string().optional().nullable().or(z.literal('')),
  status: z.string().min(1, "Status is required"),
  recovery_likelihood: z.string().min(1, "Likelihood is required"),
  notes: z.string().optional().nullable().or(z.literal('')),
}).transform(data => ({
  ...data,
  member_id: data.member_id === '' ? null : data.member_id,
  loan_id: data.loan_id === '' ? null : data.loan_id,
  last_valuation_date: data.last_valuation_date === '' ? null : data.last_valuation_date,
  notes: data.notes === '' ? null : data.notes,
}));
type AssetFormData = z.infer<typeof assetSchema>;

// --- Helper Types ---
type Branch = { id: string; name: string; };
type Member = { id: string; first_name: string; last_name: string; full_name?: string; };
type Loan = { id: string; application_no: string; };

const AssetFormPage: React.FC = () => {
    const { id: assetId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    // --- THE CRITICAL FIX: Destructure `isLoading` from the auth context ---
    const { user, profile, loading } = useAuth();
    const isEditMode = Boolean(assetId);

    const [branches, setBranches] = useState<Branch[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { register, handleSubmit, control, reset, watch, setValue, formState: { errors } } = useForm<AssetFormData>({
        resolver: zodResolver(assetSchema),
        mode: 'onChange'
    });

    const watchedMemberId = watch('member_id');

    useEffect(() => {
        // Don't fetch data until the user's profile is loaded
        if (loading) return;

        const fetchData = async () => {
            setLoadingData(true);
            try {
                const [branchRes, memberRes] = await Promise.all([
                    supabase.from('branches').select('id, name'),
                    supabase.from('members').select('id, first_name, last_name')
                ]);
                setBranches(branchRes.data || []);
                // Map members to include full_name
                const membersWithFullName = (memberRes.data || []).map((member: any) => ({
                    ...member,
                    full_name: member?.first_name && member?.last_name
                        ? `${member.first_name} ${member.last_name}`.trim()
                        : member?.first_name || member?.last_name || 'Unknown Member'
                }));
                setMembers(membersWithFullName);

                if (isEditMode && assetId) {
                    const { data: assetData } = await supabase.from('realizable_assets').select('*').eq('id', assetId).single();
                    if (assetData) {
                        // Convert branch_id to string for the form, and handle all nullable fields
                        const sanitizedData = { 
                            ...assetData, 
                            branch_id: assetData.branch_id ? String(assetData.branch_id) : '',
                            last_valuation_date: assetData.last_valuation_date || null,
                            member_id: assetData.member_id || '',
                            loan_id: assetData.loan_id || '',
                            notes: assetData.notes || ''
                        };
                        reset(sanitizedData);
                    }
                } else if (profile?.role === 'branch_admin' && profile.branch_id) {
                    // Auto-select the branch manager's branch when creating a new asset
                    setValue('branch_id', String(profile.branch_id));
                }
            } catch (e: any) {
                toast.error("Failed to load data", { description: e.message });
            } finally {
                setLoadingData(false);
            }
        };
        fetchData();
    }, [assetId, isEditMode, reset, loading, profile, setValue]);

    useEffect(() => {
        if (watchedMemberId) {
            const fetchMemberLoans = async () => {
                const { data } = await supabase.from('loans').select('id, application_no').eq('member_id', watchedMemberId);
                setLoans((data as any) || []);
            };
            fetchMemberLoans();
        } else {
            setLoans([]);
        }
    }, [watchedMemberId]);

    const onSubmit = async (data: AssetFormData) => {
        console.log('Form submitted with data:', data);
        setIsSubmitting(true);
        try {
            // Clean the data - only include fields that should be sent
            const submissionData: any = {
                asset_type: data.asset_type,
                description: data.description,
                branch_id: data.branch_id,
                last_valuation_date: data.last_valuation_date,
                member_id: data.member_id,
                loan_id: data.loan_id,
                current_market_value: data.current_market_value,
                realizable_value: data.realizable_value,
                status: data.status,
                recovery_likelihood: data.recovery_likelihood,
            };
            
            // Add notes if provided
            if (data.notes) {
                submissionData.notes = data.notes;
            }

            console.log('Submitting data:', submissionData);

            if (isEditMode) {
                console.log('Updating asset with ID:', assetId);
                const { error, data: result } = await supabase.from('realizable_assets').update(submissionData).eq('id', assetId).select();
                if (error) {
                    console.error('Update error:', error);
                    throw error;
                }
                console.log('Update result:', result);
                toast.success("Asset updated successfully!");
            } else {
                console.log('Inserting new asset');
                const { error, data: result } = await supabase.from('realizable_assets').insert(submissionData).select();
                if (error) {
                    console.error('Insert error:', error);
                    throw error;
                }
                console.log('Insert result:', result);
                toast.success("New asset added successfully!");
            }
            navigate('/realizable-report');
        } catch (error: any) {
            console.error('Submit error:', error);
            toast.error("Operation failed", { description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // --- THE CRITICAL FIX: Show a loader while auth or data is loading ---
    if (loadingData || loading) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="p-2 sm:p-4 md:p-6 max-w-4xl mx-auto">
            <Button asChild variant="outline" size="sm" className="mb-4"><Link to="/realizable-report"><ArrowLeft className="mr-2 h-4 w-4" />Back to Report</Link></Button>
            <Card>
                <CardHeader>
                    <CardTitle>{isEditMode ? 'Edit Realizable Asset' : 'Add New Realizable Asset'}</CardTitle>
                    <CardDescription>Enter the details for the asset below.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <FormField label="Asset Type" required><Controller name="asset_type" control={control} render={({ field }) => <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Select type..."/></SelectTrigger><SelectContent><SelectItem value="collateral">Collateral</SelectItem><SelectItem value="recoverable_loan">Recoverable Loan</SelectItem></SelectContent></Select>} /></FormField>
                           <FormField label="Status" required><Controller name="status" control={control} render={({ field }) => <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Select status..."/></SelectTrigger><SelectContent><SelectItem value="available">Available</SelectItem><SelectItem value="in_process">In Process</SelectItem><SelectItem value="realized">Realized</SelectItem><SelectItem value="disputed">Disputed</SelectItem></SelectContent></Select>} /></FormField>
                        </div>
                        <FormField label="Description" required><Textarea {...register('description')} /></FormField>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField label="Associated Member (Optional)"><Controller name="member_id" control={control} render={({ field }) => <Select onValueChange={field.onChange} value={field.value || ''}><SelectTrigger><SelectValue placeholder="Select a member..."/></SelectTrigger><SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}</SelectContent></Select>} /></FormField>
                            <FormField label="Associated Loan (Optional)"><Controller name="loan_id" control={control} render={({ field }) => <Select onValueChange={field.onChange} value={field.value || ''} disabled={!watchedMemberId || loans.length === 0}><SelectTrigger><SelectValue placeholder={!watchedMemberId ? "Select a member first" : "Select a loan..."}/></SelectTrigger><SelectContent>{loans.map(l => <SelectItem key={l.id} value={l.id}>{l.application_no || 'N/A'}</SelectItem>)}</SelectContent></Select>} /></FormField>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FormField label="Market Value (KES)" required><Input type="number" step="0.01" {...register('current_market_value')} /></FormField>
                            <FormField label="Realizable Value (KES)" required><Input type="number" step="0.01" {...register('realizable_value')} /></FormField>
                            <FormField label="Last Valuation Date"><Input type="date" {...register('last_valuation_date')} /></FormField>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* --- THE CRITICAL FIX: Use optional chaining `profile?.role` --- */}
                            <FormField label="Branch" required>
                                <Controller name="branch_id" control={control} render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={String(field.value || '')} disabled={profile?.role === 'branch_admin'}>
                                        <SelectTrigger><SelectValue placeholder="Select branch..."/></SelectTrigger>
                                        <SelectContent>{branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                )} />
                            </FormField>
                            <FormField label="Recovery Likelihood" required><Controller name="recovery_likelihood" control={control} render={({ field }) => <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Select likelihood..."/></SelectTrigger><SelectContent><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent></Select>} /></FormField>
                        </div>
                        
                        {Object.keys(errors).length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-md p-4">
                                <p className="text-sm font-medium text-red-800 mb-2">Please fix the following errors:</p>
                                <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                                    {Object.entries(errors).map(([key, error]: [string, any]) => (
                                        <li key={key}>{error.message || `Invalid ${key}`}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isEditMode ? 'Save Changes' : 'Add Asset'}</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

const FormField: React.FC<{ label: string; children: React.ReactNode; required?: boolean; }> = ({ label, children, required }) => (
    <div className="space-y-2"><Label className="flex items-center">{label}{required && <span className="text-red-500 ml-1">*</span>}</Label>{children}</div>
);

export default AssetFormPage;