import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate, useSearchParams, Link, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, CheckCircle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const loanSchema = z.object({
  customer_id: z.string().uuid("A valid member must be selected"),
  principal_amount: z.preprocess(val => Number(val), z.number().min(1, "Principal is required")),
  interest_rate: z.preprocess(val => Number(val), z.number().min(0, "Interest rate is required")),
  issue_date: z.string().min(1, "Issue date is required"),
  due_date: z.string().min(1, "Due date is required"),
  repayment_schedule: z.string().min(1, "Repayment schedule is required"),
  loan_officer_id: z.string().uuid("An officer must be assigned"),
});
type LoanFormData = z.infer<typeof loanSchema>;

type Member = { id: string; full_name: string; branch_id: number; group_id: number; };
type Officer = { id: string; full_name: string; };

const LoanFormPage: React.FC = () => {
    const { id: loanId } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isEditMode = Boolean(loanId);

    const [members, setMembers] = useState<Member[]>([]);
    const [officers, setOfficers] = useState<Officer[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [successId, setSuccessId] = useState<string | null>(null);
    const [memberSearchTerm, setMemberSearchTerm] = useState('');
    const [showMemberResults, setShowMemberResults] = useState(false);
    
    const prefilledMemberId = searchParams.get('memberId');
    const prefilledMemberName = searchParams.get('memberName');

    const { register, handleSubmit, control, reset, setValue, formState: { errors } } = useForm<LoanFormData>({
        resolver: zodResolver(loanSchema)
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoadingData(true);
            try {
                const [membersRes, officersRes] = await Promise.all([
                    supabase.from('members').select('id, full_name, branch_id, group_id'),
                    supabase.from('profiles').select('id, full_name').in('role', ['loan_officer', 'super_admin', 'branch_manager'])
                ]);
                setMembers(membersRes.data || []);
                setOfficers(officersRes.data || []);
                
                if (prefilledMemberId) { 
                    setValue('customer_id', prefilledMemberId);
                    const member = membersRes.data?.find(m => m.id === prefilledMemberId);
                    if (member) {
                        setMemberSearchTerm(member.full_name);
                    }
                }
                setValue('issue_date', new Date().toISOString().split('T')[0]);

            } catch (e: any) {
                toast.error("Failed to load data", { description: e.message });
            } finally {
                setLoadingData(false);
            }
        };
        fetchData();
    }, [prefilledMemberId, setValue]);

    const onSubmit = async (data: LoanFormData) => {
        setIsSubmitting(true);
        setFormError(null);
        try {
            const selectedMember = members.find(m => m.id === data.customer_id);
            if (!selectedMember) throw new Error("Selected member not found. Please refresh and try again.");

            const principal = data.principal_amount;
            const interestRate = data.interest_rate / 100;
            const currentBalance = principal * (1 + interestRate);

            const loanData = {
                ...data,
                // --- THE CRITICAL FIX IS HERE ---
                // We are now providing a value for the 'interest_type' column.
                interest_type: 'simple', 
                
                branch_id: selectedMember.branch_id,
                group_id: selectedMember.group_id,
                created_by: user?.id,
                status: 'pending',
                current_balance: currentBalance,
                total_paid: 0,
            };

            const { data: newLoan, error } = await supabase.from('loans').insert(loanData).select('id').single();
            if (error) throw error;
            
            toast.success("Loan created successfully!", { description: "The loan is now pending approval." });
            setSuccessId(newLoan.id);

        } catch (error: any) {
            setFormError(error.message);
            toast.error("Failed to create loan", { description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (loadingData) { return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>; }

    if (successId) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-2 sm:p-4 md:p-6 text-center">
                <Card className="max-w-md">
                  <CardHeader>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                    <CardTitle className="mt-4">Loan Created Successfully!</CardTitle>
                    <CardDescription>The new loan is now pending approval.</CardDescription>
                  </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    <Button asChild><Link to={`/loans/${successId}`}>View Loan Details</Link></Button>
                    {prefilledMemberId && <Button variant="outline" asChild><Link to={`/members/${prefilledMemberId}`}>Back to Member Profile</Link></Button>}
                    <Button variant="ghost" asChild><Link to="/loans">Go to Loans List</Link></Button>
                </CardContent></Card>
            </div>
        );
    }

    return (
        <div className="p-2 sm:p-4 md:p-6 max-w-2xl mx-auto">
            <Button asChild variant="outline" size="sm" className="mb-4"><Link to={prefilledMemberId ? `/members/${prefilledMemberId}` : '/loans'}><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
            <Card>
              <CardHeader>
                <CardTitle>{isEditMode ? 'Edit Loan' : 'Create New Loan'}</CardTitle>
                <CardDescription>Fill in the details below to disburse a new loan.</CardDescription>
              </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        {formError && <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>}
                        
                        {prefilledMemberName && <Alert><Info className="h-4 w-4" /><AlertDescription>Creating a new loan for <strong>{prefilledMemberName}</strong>.</AlertDescription></Alert>}

                        <FormField label="Member" error={errors.customer_id} required>
                            <Controller name="customer_id" control={control} render={({ field }) => (
                                <div className="relative">
                                    <Input
                                        type="text"
                                        placeholder="Search for a member..."
                                        value={memberSearchTerm}
                                        onChange={(e) => {
                                            const searchTerm = e.target.value;
                                            setMemberSearchTerm(searchTerm);
                                            setShowMemberResults(true);
                                            
                                            if (!searchTerm) {
                                                field.onChange('');
                                                setShowMemberResults(false);
                                                return;
                                            }
                                        }}
                                        onFocus={() => setShowMemberResults(true)}
                                        onBlur={() => {
                                            // Delay hiding results to allow clicking on them
                                            setTimeout(() => setShowMemberResults(false), 200);
                                        }}
                                        disabled={!!prefilledMemberId}
                                        className="w-full"
                                    />
                                    
                                    {/* Search Results Dropdown */}
                                    {showMemberResults && !prefilledMemberId && memberSearchTerm && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                                            {members
                                                .filter(member => 
                                                    member.full_name.toLowerCase().includes(memberSearchTerm.toLowerCase())
                                                )
                                                .slice(0, 10) // Limit to 10 results
                                                .map(member => (
                                                    <div
                                                        key={member.id}
                                                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault(); // Prevent onBlur from firing
                                                            field.onChange(member.id);
                                                            setMemberSearchTerm(member.full_name);
                                                            setShowMemberResults(false);
                                                        }}
                                                    >
                                                        <div className="font-medium text-gray-900">{member.full_name}</div>
                                                        <div className="text-sm text-gray-500">ID: {member.id}</div>
                                                    </div>
                                                ))
                                            }
                                            {members.filter(member => 
                                                member.full_name.toLowerCase().includes(memberSearchTerm.toLowerCase())
                                            ).length === 0 && (
                                                <div className="px-4 py-2 text-gray-500 text-center">
                                                    No members found
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )} />
                        </FormField>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField label="Principal Amount (KES)" error={errors.principal_amount} required><Input type="number" step="0.01" {...register('principal_amount')} /></FormField>
                            <FormField label="Interest Rate (%)" error={errors.interest_rate} required><Input type="number" step="0.1" {...register('interest_rate')} defaultValue="10" /></FormField>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField label="Issue Date" error={errors.issue_date} required><Input type="date" {...register('issue_date')} /></FormField>
                            <FormField label="Due Date" error={errors.due_date} required><Input type="date" {...register('due_date')} /></FormField>
                        </div>

                        <FormField label="Repayment Schedule" error={errors.repayment_schedule} required>
                            <Controller name="repayment_schedule" control={control} render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger><SelectValue placeholder="Select a schedule..." /></SelectTrigger>
                                    <SelectContent><SelectItem value="Weekly">Weekly</SelectItem><SelectItem value="Monthly">Monthly</SelectItem><SelectItem value="End of Term">End of Term</SelectItem></SelectContent>
                                </Select>
                            )} />
                        </FormField>
                        
                        <FormField label="Assign to Officer" error={errors.loan_officer_id} required>
                            <Controller name="loan_officer_id" control={control} render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger><SelectValue placeholder="Select an officer..." /></SelectTrigger>
                                    <SelectContent>{officers.map(o => <SelectItem key={o.id} value={o.id}>{o.full_name}</SelectItem>)}</SelectContent>
                                </Select>
                            )} />
                        </FormField>

                        <Button type="submit" disabled={isSubmitting} className="w-full">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isEditMode ? 'Save Changes' : 'Submit for Approval'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

const FormField: React.FC<{ label: string; error?: { message?: string }; children: React.ReactNode; required?: boolean; }> = ({ label, error, children, required }) => (
    <div className="space-y-2"><Label className="flex items-center">{label}{required && <span className="text-red-500 ml-1">*</span>}</Label>{children}{error && <p className="text-sm text-red-500 mt-1">{error.message}</p>}</div>
);

export default LoanFormPage;