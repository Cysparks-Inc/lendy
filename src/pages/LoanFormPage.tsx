import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import { Loader2, ArrowLeft, CheckCircle, Info, Calculator, Calendar, CreditCard } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const loanSchema = z.object({
  customer_id: z.string().uuid("A valid member must be selected"),
  loan_program: z.enum(['small_loan', 'big_loan'], { required_error: "Loan program is required" }),
  principal_amount: z.preprocess(val => Number(val), z.number().min(1, "Principal is required")),
  issue_date: z.string().min(1, "Issue date is required"),
  installment_type: z.enum(['weekly', 'monthly', 'daily']).default('weekly'),
  loan_officer_id: z.string().uuid("An officer must be assigned").optional(),
  branch_id: z.preprocess(val => val === null || val === undefined || val === '' ? null : Number(val), z.number().nullable().optional()),
  group_id: z.preprocess(val => val === null || val === undefined || val === '' ? null : Number(val), z.number().nullable().optional()),
});

type LoanFormData = z.infer<typeof loanSchema>;

interface Member { 
  id: string; 
  full_name: string; 
  branch_id: number | null; 
  group_id: number | null;
  branch_name: string | null;
  group_name: string | null;
  id_number?: string;
  phone_number?: string;
}

interface Officer { 
  id: string; 
  full_name: string; 
}

interface Branch { 
  id: number; 
  name: string; 
}

interface Group { 
  id: number; 
  name: string; 
}

interface LoanCalculation {
  interest_rate: number;
  repayment_weeks: number;
  processing_fee: number;
  interest_amount: number;
  total_disbursed: number;
}

interface InstallmentSchedule {
  installment_number: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  total_amount: number;
}

// Helper function to get current date in YYYY-MM-DD format
const getCurrentDate = (): string => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

// Loan Increment Rules
const LOAN_INCREMENT_LEVELS = [5000, 7000, 9000, 11000, 13000, 15000, 17000, 20000, 25000, 30000, 35000, 40000, 45000, 50000];

const validateLoanIncrement = (requestedAmount: number, memberId: string, userRole: string): { isValid: boolean; message?: string; suggestedAmount?: number } => {
  // Only apply rules to non-admin users
  if (userRole === 'super_admin' || userRole === 'admin') {
    return { isValid: true };
  }

  // For admin users, they can skip increment levels
  if (userRole === 'admin' || userRole === 'super_admin') {
    return { isValid: true };
  }

  // Find the appropriate increment level for the requested amount
  const currentLevel = LOAN_INCREMENT_LEVELS.find(level => level >= requestedAmount);
  
  if (!currentLevel) {
    return { 
      isValid: false, 
      message: `Maximum loan amount is KES ${LOAN_INCREMENT_LEVELS[LOAN_INCREMENT_LEVELS.length - 1].toLocaleString()}`,
      suggestedAmount: LOAN_INCREMENT_LEVELS[LOAN_INCREMENT_LEVELS.length - 1]
    };
  }

  // Check if amount is exactly at an increment level or less than previous
  const currentLevelIndex = LOAN_INCREMENT_LEVELS.indexOf(currentLevel);
  const previousLevel = currentLevelIndex > 0 ? LOAN_INCREMENT_LEVELS[currentLevelIndex - 1] : 0;
  
  // Allow borrowing less than previous amount
  if (requestedAmount <= previousLevel) {
    return { isValid: true };
  }

  // Must be exactly at increment level
  if (requestedAmount !== currentLevel) {
    return { 
      isValid: false, 
      message: `Loan amount must follow increment levels. Next available amount is KES ${currentLevel.toLocaleString()}`,
      suggestedAmount: currentLevel
    };
  }

  return { isValid: true };
};

const validatePaymentTerms = (amount: number, installmentType: string): { isValid: boolean; message?: string } => {
  // KES 5,000-7,000: 8 weeks only
  if (amount >= 5000 && amount <= 7000) {
    if (installmentType !== 'weekly') {
      return { 
        isValid: false, 
        message: 'Loans between KES 5,000-7,000 must be paid in 8 weeks (weekly installments only)' 
      };
    }
  }
  
  // KES 9,000+: 8 or 12 weeks
  if (amount >= 9000) {
    if (installmentType !== 'weekly') {
      return { 
        isValid: false, 
        message: 'Loans KES 9,000+ must be paid in 8 or 12 weeks (weekly installments only)' 
      };
    }
  }

  return { isValid: true };
};

const LoanFormPage: React.FC = () => {
    const { id: loanId } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    const isEditMode = Boolean(loanId);
    const userRole = profile?.role || 'member';

    // Data states
    const [members, setMembers] = useState<Member[]>([]);
    const [officers, setOfficers] = useState<Officer[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    
    // UI states
    const [loadingData, setLoadingData] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [successId, setSuccessId] = useState<string | null>(null);
    const [memberSearchTerm, setMemberSearchTerm] = useState('');
    const [showMemberResults, setShowMemberResults] = useState(false);
    const [loanCalculation, setLoanCalculation] = useState<LoanCalculation | null>(null);
    const [installmentSchedule, setInstallmentSchedule] = useState<InstallmentSchedule[]>([]);
    
    const prefilledMemberId = searchParams.get('memberId');
    const prefilledMemberName = searchParams.get('memberName');

    const { register, handleSubmit, control, reset, setValue, watch, getValues, formState: { errors } } = useForm<LoanFormData>({
        resolver: zodResolver(loanSchema),
        defaultValues: {
            branch_id: null,
            group_id: null,
            installment_type: 'weekly',
            issue_date: getCurrentDate() // Set current date as default
        }
    });

    const watchedPrincipal = watch('principal_amount');
    const watchedLoanProgram = watch('loan_program');
    const watchedIssueDate = watch('issue_date');
    const watchedInstallmentType = watch('installment_type');
    const watchedCustomerId = watch('customer_id');

    // Memoized selected member to prevent unnecessary recalculations
    const selectedMember = useMemo(() => {
        if (!watchedCustomerId || members.length === 0) return null;
        return members.find(m => m.id === watchedCustomerId) || null;
    }, [watchedCustomerId, members]);

    // Enhanced member formatter with better error handling
    const formatMemberWithBranchGroup = useCallback((memberData: any, branchesData: Branch[], groupsData: Group[]): Member => {
        const branchName = memberData.branch_id 
            ? branchesData.find(b => b.id === memberData.branch_id)?.name || null
            : null;
        
        const groupName = memberData.group_id 
            ? groupsData.find(g => g.id === memberData.group_id)?.name || null
            : null;
        
        return {
            id: memberData.id,
            full_name: memberData.full_name,
            branch_id: memberData.branch_id,
            group_id: memberData.group_id,
            branch_name: branchName,
            group_name: groupName,
            id_number: memberData.id_number,
            phone_number: memberData.phone_number
        };
    }, []);

    // Access control for editing loans - only super admins can edit
    useEffect(() => {
        if (isEditMode && userRole !== 'super_admin') {
            toast.error('Access Denied', { 
                description: 'Only Super Admins can edit loans. Please contact your administrator.' 
            });
            navigate('/loans');
            return;
        }
    }, [isEditMode, userRole, navigate]);

    // Load initial data with proper error handling and sequencing
    useEffect(() => {
        const loadInitialData = async () => {
            setLoadingData(true);
            try {
                // Load reference data first (branches, groups, officers)
                const [branchesRes, groupsRes, officersRes] = await Promise.all([
                    supabase.from('branches').select('id, name').order('name'),
                    supabase.from('groups').select('id, name').order('name'),
                    supabase.from('profiles')
                        .select('id, full_name')
                        .in('role', ['loan_officer', 'super_admin', 'branch_manager'])
                        .order('full_name')
                ]);

                if (branchesRes.error) throw branchesRes.error;
                if (groupsRes.error) throw groupsRes.error;
                if (officersRes.error) throw officersRes.error;

                const branchesData = branchesRes.data || [];
                const groupsData = groupsRes.data || [];
                const officersData = officersRes.data || [];

                setBranches(branchesData);
                setGroups(groupsData);
                setOfficers(officersData);

                // If we have a prefilled member ID, load that specific member
                if (prefilledMemberId) {
                    const { data: memberData, error: memberError } = await supabase
                        .from('members')
                        .select('id, full_name, branch_id, group_id, id_number, phone_number')
                        .eq('id', prefilledMemberId)
                        .eq('status', 'active')
                        .single();

                    if (memberError) throw memberError;
                    
                    if (memberData) {
                        const formattedMember = formatMemberWithBranchGroup(memberData, branchesData, groupsData);
                        setMembers([formattedMember]);
                        setMemberSearchTerm(formattedMember.full_name);
                        
                        // Set form values with proper types
                        setValue('customer_id', formattedMember.id);
                        setValue('branch_id', formattedMember.branch_id);
                        setValue('group_id', formattedMember.group_id);
                    }
                } else {
                    // Load a limited set of members for initial display
                    const { data: membersData, error: membersError } = await supabase
                        .from('members')
                        .select('id, full_name, branch_id, group_id, id_number, phone_number')
                        .eq('status', 'active')
                        .limit(50)
                        .order('full_name');

                    if (membersError) throw membersError;
                    
                    if (membersData) {
                        const formattedMembers = membersData.map(member => 
                            formatMemberWithBranchGroup(member, branchesData, groupsData)
                        );
                        setMembers(formattedMembers);
                    }
                }

                // If in edit mode, load the existing loan data
                if (isEditMode && loanId) {
                    try {
                        const { data: loanData, error: loanError } = await supabase
                            .from('loans')
                            .select('*')
                            .eq('id', loanId)
                            .single();

                        if (loanError) throw loanError;

                        if (loanData) {
                            // Get the member ID (could be either member_id or customer_id)
                            const memberId = loanData.customer_id;
                            
                            if (memberId) {
                                // Load the member data for this loan
                                const { data: memberData, error: memberError } = await supabase
                                    .from('members')
                                    .select('id, full_name, branch_id, group_id, id_number, phone_number')
                                    .eq('id', memberId)
                                    .single();

                                if (memberError) throw memberError;

                                if (memberData) {
                                    const formattedMember = formatMemberWithBranchGroup(memberData, branchesData, groupsData);
                                    setMembers([formattedMember]);
                                    setMemberSearchTerm(formattedMember.full_name);
                                }
                            }

                            // Populate the form with existing loan data using correct column names
                            reset({
                                customer_id: memberId || '',
                                loan_program: loanData.loan_program || 'small_loan',
                                principal_amount: loanData.principal_amount || 0,
                                issue_date: loanData.issue_date || getCurrentDate(),
                                installment_type: (loanData.repayment_schedule as 'weekly' | 'monthly') || 'weekly',
                                loan_officer_id: loanData.loan_officer_id || '',
                                branch_id: loanData.branch_id,
                                group_id: loanData.group_id
                            });
                        }
                    } catch (error: any) {
                        toast.error("Failed to load loan data", { description: error.message });
                    }
                }

            } catch (error: any) {
                toast.error("Failed to load data", { description: error.message });
            } finally {
                setLoadingData(false);
            }
        };

        loadInitialData();
    }, [prefilledMemberId, isEditMode, loanId, setValue, formatMemberWithBranchGroup, reset]);

    // Handle member selection changes with debounced updates
    useEffect(() => {
        if (!selectedMember) {
            setValue('branch_id', null);
            setValue('group_id', null);
            return;
        }

        // Only update if the values are actually different
        const currentBranchId = getValues('branch_id');
        const currentGroupId = getValues('group_id');
        
        if (currentBranchId !== selectedMember.branch_id) {
            setValue('branch_id', selectedMember.branch_id);
        }
        
        if (currentGroupId !== selectedMember.group_id) {
            setValue('group_id', selectedMember.group_id);
        }
    }, [selectedMember, setValue, getValues]);

    // Optimized member search with debouncing
    const searchMembers = useCallback(async (searchTerm: string) => {
        if (!searchTerm.trim() || searchTerm.length < 2) {
            setShowMemberResults(false);
            return;
        }

        try {
            const { data: memberData, error } = await supabase
                .from('members')
                .select('id, full_name, branch_id, group_id, id_number, phone_number')
                .or(`full_name.ilike.%${searchTerm.trim()}%,id_number.ilike.%${searchTerm.trim()}%,phone_number.ilike.%${searchTerm.trim()}%`)
                .eq('status', 'active')
                .limit(15)
                .order('full_name');

            if (error) throw error;

            if (memberData) {
                const formattedMembers = memberData.map(member => 
                    formatMemberWithBranchGroup(member, branches, groups)
                );
                setMembers(formattedMembers);
                setShowMemberResults(true);
            }
        } catch (error: any) {
            toast.error('Failed to search members');
            setShowMemberResults(false);
        }
    }, [branches, groups, formatMemberWithBranchGroup]);

    // Debounced search handler
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (memberSearchTerm && !prefilledMemberId) {
                searchMembers(memberSearchTerm);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [memberSearchTerm, searchMembers, prefilledMemberId]);

    // Calculate loan details
    const calculateLoanDetails = useCallback((principal: number, loanProgram: string) => {
        let interestRate: number;
        let repaymentWeeks: number;

        if (loanProgram === 'small_loan') {
            interestRate = 15;
            repaymentWeeks = 8;
        } else if (loanProgram === 'big_loan') {
            interestRate = 20;
            repaymentWeeks = 12;
        } else {
            return;
        }

        const principalNum = Number(principal);
        const processingFee = Math.round(principalNum * 0.06 * 100) / 100;
        const interestAmount = Math.round(principalNum * (interestRate / 100) * 100) / 100;
        const totalAmountToRepay = principalNum + interestAmount;

        const calculation = {
            interest_rate: interestRate,
            repayment_weeks: repaymentWeeks,
            processing_fee: processingFee,
            interest_amount: interestAmount,
            total_disbursed: totalAmountToRepay
        };
        
        setLoanCalculation(calculation);
    }, []);

    // Generate installment schedule
    const generateInstallmentSchedule = useCallback(() => {
        if (!loanCalculation || !watchedIssueDate || !watchedPrincipal) return;

        const schedule: InstallmentSchedule[] = [];
        const { interest_amount, repayment_weeks } = loanCalculation;
        const issueDate = new Date(watchedIssueDate);

        const weeklyPrincipal = Math.round((watchedPrincipal / repayment_weeks) * 100) / 100;
        const weeklyInterest = Math.round((interest_amount / repayment_weeks) * 100) / 100;

        for (let i = 1; i <= repayment_weeks; i++) {
            const dueDate = new Date(issueDate);
            dueDate.setDate(issueDate.getDate() + (i * 7));

            let installmentPrincipal = weeklyPrincipal;
            let installmentInterest = weeklyInterest;

            // Adjust last installment for rounding
            if (i === repayment_weeks) {
                installmentPrincipal = Math.round((watchedPrincipal - (weeklyPrincipal * (repayment_weeks - 1))) * 100) / 100;
                installmentInterest = Math.round((interest_amount - (weeklyInterest * (repayment_weeks - 1))) * 100) / 100;
            }

            schedule.push({
                installment_number: i,
                due_date: dueDate.toISOString().split('T')[0],
                principal_amount: installmentPrincipal,
                interest_amount: installmentInterest,
                total_amount: Math.round((installmentPrincipal + installmentInterest) * 100) / 100
            });
        }

        setInstallmentSchedule(schedule);
    }, [loanCalculation, watchedIssueDate, watchedPrincipal]);

    // Effect for loan calculations
    useEffect(() => {
        if (watchedPrincipal && watchedLoanProgram) {
            calculateLoanDetails(watchedPrincipal, watchedLoanProgram);
        }
    }, [watchedPrincipal, watchedLoanProgram, calculateLoanDetails]);

    // Effect for installment schedule
    useEffect(() => {
        generateInstallmentSchedule();
    }, [generateInstallmentSchedule]);

    // Form submission
    const onSubmit = async (data: LoanFormData) => {
        setIsSubmitting(true);
        setFormError(null);
        
        try {
            if (!selectedMember) {
                throw new Error("Selected member not found. Please refresh and try again.");
            }

            if (!loanCalculation) {
                throw new Error("Please ensure loan program and principal amount are set");
            }

            // Check if member has pending loans (only for new loans)
            if (!isEditMode) {
                const { data: pendingLoans, error: pendingError } = await supabase
                    .rpc('member_has_pending_loans', { _member_id: data.customer_id });

                if (pendingError) throw pendingError;

                if (pendingLoans) {
                    throw new Error("Member has pending loans. Cannot create a new loan.");
                }
            }

            // Apply loan increment rules validation (only for new loans)
            if (!isEditMode) {
                const incrementValidation = validateLoanIncrement(data.principal_amount, data.customer_id, userRole);
                if (!incrementValidation.isValid) {
                    if (incrementValidation.suggestedAmount) {
                        toast.error(incrementValidation.message!, {
                            description: `Suggested amount: KES ${incrementValidation.suggestedAmount.toLocaleString()}`,
                            action: {
                                label: "Use Suggested Amount",
                                onClick: () => setValue('principal_amount', incrementValidation.suggestedAmount!)
                            }
                        });
                    } else {
                        toast.error(incrementValidation.message!);
                    }
                    throw new Error(incrementValidation.message);
                }

                // Apply payment terms validation
                const paymentTermsValidation = validatePaymentTerms(data.principal_amount, data.installment_type);
                if (!paymentTermsValidation.isValid) {
                    toast.error(paymentTermsValidation.message!);
                    throw new Error(paymentTermsValidation.message);
                }

                // Show success toast for valid increment level
                const currentLevel = LOAN_INCREMENT_LEVELS.find(level => level >= data.principal_amount);
                if (currentLevel && data.principal_amount === currentLevel) {
                    toast.success(`Valid loan amount: KES ${data.principal_amount.toLocaleString()}`, {
                        description: "Amount follows the increment level rules"
                    });
                }
            }

            // Calculate due date (8 weeks for small loan, 12 weeks for big loan)
            const weeksToAdd = data.loan_program === 'small_loan' ? 8 : 12;
            const dueDate = new Date(data.issue_date);
            dueDate.setDate(dueDate.getDate() + (weeksToAdd * 7));

            // Prepare loan data for submission
            const loanData = {
                customer_id: data.customer_id,
                loan_program: data.loan_program,
                principal_amount: data.principal_amount,
                interest_rate: loanCalculation.interest_rate,
                interest_type: 'simple' as const,
                repayment_schedule: 'weekly', // Fixed: use 'weekly' (lowercase) to match database enum
                issue_date: data.issue_date,
                due_date: dueDate.toISOString().split('T')[0],
                installment_type: data.installment_type,
                branch_id: data.branch_id,
                group_id: data.group_id,
                loan_officer_id: user?.role === 'loan_officer' ? user.id : data.loan_officer_id,
                created_by: user?.id,
                status: 'pending' as const,
                current_balance: loanCalculation.total_disbursed,
                total_paid: 0,
                processing_fee: loanCalculation.processing_fee,
                interest_disbursed: loanCalculation.interest_amount,
                total_disbursed: loanCalculation.total_disbursed,
            };

            const { data: newLoan, error } = await supabase
                .from('loans')
                .insert(loanData)
                .select('id')
                .single();
                
            if (error) throw error;
            
            toast.success("Loan created successfully!", { 
                description: "The loan is now pending approval." 
            });
            setSuccessId(newLoan.id);

        } catch (error: any) {
            setFormError(error.message);
            toast.error("Failed to create loan", { description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Helper function for day names
    const getDayName = (dayNumber: number): string => {
        const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        return days[dayNumber] || 'Unknown';
    };

    if (loadingData) { 
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        ); 
    }

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
                        <Button asChild>
                            <Link to={`/loans/${successId}`}>View Loan Details</Link>
                        </Button>
                        {prefilledMemberId && (
                            <Button variant="outline" asChild>
                                <Link to={`/members/${prefilledMemberId}`}>Back to Member Profile</Link>
                            </Button>
                        )}
                        <Button variant="ghost" asChild>
                            <Link to="/loans">Go to Loans List</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-2 sm:p-4 md:p-6 max-w-4xl mx-auto">
            <Button asChild variant="outline" size="sm" className="mb-4">
                <Link to={prefilledMemberId ? `/members/${prefilledMemberId}` : '/loans'}>
                    <ArrowLeft className="mr-2 h-4 w-4" />Back
                </Link>
            </Button>
            
            <Card>
                <CardHeader>
                    <CardTitle>{isEditMode ? 'Edit Loan' : 'Create New Loan'}</CardTitle>
                    <CardDescription>Fill in the details below to disburse a new loan.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        {formError && (
                            <Alert variant="destructive">
                                <AlertDescription>{formError}</AlertDescription>
                            </Alert>
                        )}
                        
                        {prefilledMemberName && (
                            <Alert>
                                <Info className="h-4 w-4" />
                                <AlertDescription>
                                    Creating a new loan for <strong>{prefilledMemberName}</strong>.
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Member Selection */}
                        <FormField label="Member" error={errors.customer_id} required>
                            <Controller 
                                name="customer_id" 
                                control={control} 
                                render={({ field }) => (
                                    <div className="relative">
                                        <Input
                                            type="text"
                                            placeholder="Search for a member..."
                                            value={memberSearchTerm}
                                            onChange={(e) => {
                                                const searchTerm = e.target.value;
                                                setMemberSearchTerm(searchTerm);
                                                
                                                if (!searchTerm) {
                                                    field.onChange('');
                                                    setShowMemberResults(false);
                                                }
                                            }}
                                            onFocus={() => {
                                                if (memberSearchTerm && !prefilledMemberId) {
                                                    setShowMemberResults(true);
                                                }
                                            }}
                                            onBlur={() => {
                                                setTimeout(() => setShowMemberResults(false), 200);
                                            }}
                                            disabled={!!prefilledMemberId}
                                            className="w-full"
                                        />
                                        
                                        {showMemberResults && !prefilledMemberId && memberSearchTerm && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                                                {members.length > 0 ? (
                                                    members.map(member => (
                                                        <div
                                                            key={member.id}
                                                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                                                            onMouseDown={(e) => {
                                                                e.preventDefault();
                                                                field.onChange(member.id);
                                                                setMemberSearchTerm(member.full_name);
                                                                setShowMemberResults(false);
                                                            }}
                                                        >
                                                            <div className="font-medium text-gray-900">{member.full_name}</div>
                                                            <div className="text-sm text-gray-500">
                                                                {member.branch_name || 'No branch'} • {member.group_name || 'No group'}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="px-4 py-2 text-gray-500 text-center">
                                                        No members found
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        
                                        {/* Show selected member info */}
                                        {selectedMember && (
                                            <div className="mt-2 p-2 bg-blue-50 rounded-md border border-blue-200">
                                                <div className="text-sm text-blue-600 font-medium">Selected Member</div>
                                                <div className="text-blue-900 font-semibold">{selectedMember.full_name}</div>
                                                <div className="text-xs text-blue-700 mt-1">
                                                    Branch: {selectedMember.branch_name || 'Not assigned'} • Group: {selectedMember.group_name || 'Not assigned'}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )} 
                            />
                        </FormField>

                        {/* Branch and Group Selection */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField label="Branch" error={errors.branch_id}>
                                <Controller 
                                    name="branch_id" 
                                    control={control} 
                                    render={({ field }) => {
                                        const branchName = field.value ? branches.find(b => b.id === field.value)?.name : null;
                                        const isDisabled = !!selectedMember;
                                        
                                        return (
                                            <Select 
                                                onValueChange={(value) => field.onChange(Number(value))} 
                                                value={field.value?.toString() || ''} 
                                                disabled={isDisabled}
                                            >
                                                <SelectTrigger className={isDisabled ? 'bg-gray-50 cursor-not-allowed' : ''}>
                                                    <SelectValue placeholder={
                                                        branchName || selectedMember?.branch_name || "Select a branch..."
                                                    } />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {branches.map(branch => (
                                                        <SelectItem key={branch.id} value={branch.id.toString()}>
                                                            {branch.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        );
                                    }} 
                                />
                                {selectedMember && (
                                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                        </svg>
                                        Auto-filled from selected member
                                    </p>
                                )}
                            </FormField>

                            <FormField label="Group" error={errors.group_id}>
                                <Controller 
                                    name="group_id" 
                                    control={control} 
                                    render={({ field }) => {
                                                                                 const group = field.value ? groups.find(g => g.id === field.value) : null;
                                         const groupDisplayName = group ? group.name : null;
                                        const isDisabled = !!selectedMember;
                                        
                                        return (
                                            <Select 
                                                onValueChange={(value) => field.onChange(Number(value))} 
                                                value={field.value?.toString() || ''} 
                                                disabled={isDisabled}
                                            >
                                                <SelectTrigger className={isDisabled ? 'bg-gray-50 cursor-not-allowed' : ''}>
                                                    <SelectValue placeholder={
                                                        groupDisplayName || 
                                                        (selectedMember?.group_name ? `${selectedMember.group_name}` : null) || 
                                                        "Select a group..."
                                                    } />
                                                </SelectTrigger>
                                                <SelectContent>
                                                                                                         {groups.map(group => (
                                                         <SelectItem key={group.id} value={group.id.toString()}>
                                                             {group.name}
                                                         </SelectItem>
                                                     ))}
                                                </SelectContent>
                                            </Select>
                                        );
                                    }} 
                                />
                                {selectedMember && (
                                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                        </svg>
                                        Auto-filled from selected member
                                    </p>
                                )}
                            </FormField>
                        </div>

                        {/* Loan Program and Principal */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField label="Loan Program" error={errors.loan_program} required>
                                <Controller 
                                    name="loan_program" 
                                    control={control} 
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select loan program..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="small_loan">
                                                    Small Loan (8 weeks, 15% interest)
                                                </SelectItem>
                                                <SelectItem value="big_loan">
                                                    Big Loan (12 weeks, 20% interest)
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )} 
                                />
                            </FormField>

                            <FormField label="Principal Amount (KES)" error={errors.principal_amount} required>
                                <Input 
                                    type="number" 
                                    step="0.01" 
                                    {...register('principal_amount')}
                                    placeholder="Enter principal amount"
                                />
                            </FormField>
                        </div>

                        {/* Issue Date and Installment Type */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField label="Issue Date" error={errors.issue_date} required>
                                <Input type="date" {...register('issue_date')} />
                            </FormField>

                            <FormField label="Installment Type" error={errors.installment_type} required>
                                <Controller 
                                    name="installment_type" 
                                    control={control} 
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select installment type..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="weekly">Weekly</SelectItem>
                                                <SelectItem value="monthly">Monthly</SelectItem>
                                                <SelectItem value="daily">Daily</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )} 
                                />
                            </FormField>
                        </div>

                        {/* Loan Officer Assignment */}
                        {user?.role !== 'loan_officer' && (
                            <FormField label="Assign to Officer" error={errors.loan_officer_id} required>
                                <Controller 
                                    name="loan_officer_id" 
                                    control={control} 
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select an officer..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {officers.map(officer => (
                                                    <SelectItem key={officer.id} value={officer.id}>
                                                        {officer.full_name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )} 
                                />
                            </FormField>
                        )}
                        
                        {/* Show assigned officer info for loan officers */}
                        {user?.role === 'loan_officer' && (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="text-sm text-blue-600 font-medium">Assigned Officer</div>
                                <div className="text-blue-900">{user?.full_name || 'You'}</div>
                                <div className="text-xs text-blue-600 mt-1">
                                    This field is automatically filled for loan officers
                                </div>
                            </div>
                        )}

                        {/* Loan Calculation Summary */}
                        {loanCalculation && (
                            <Card className="bg-green-50 border-green-200">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Calculator className="h-5 w-5 text-green-600" />
                                        Loan Calculation Summary
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="text-center">
                                            <div className="text-sm text-gray-600">Interest Rate</div>
                                            <div className="text-lg font-semibold text-green-700">
                                                {loanCalculation.interest_rate}%
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-sm text-gray-600">Repayment Period</div>
                                            <div className="text-lg font-semibold text-green-700">
                                                {loanCalculation.repayment_weeks} weeks
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-sm text-gray-600">Processing Fee</div>
                                            <div className="text-lg font-semibold text-green-700">
                                                KES {loanCalculation.processing_fee.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-sm text-gray-600">Interest Amount</div>
                                            <div className="text-lg font-semibold text-green-700">
                                                KES {loanCalculation.interest_amount.toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 p-3 bg-green-100 rounded-lg">
                                        <div className="text-center">
                                            <div className="text-sm text-gray-600">Total Amount to be Repaid</div>
                                            <div className="text-2xl font-bold text-green-800">
                                                KES {Number(loanCalculation.total_disbursed).toLocaleString()}
                                            </div>
                                            <div className="text-xs text-green-700 mt-1">
                                                Principal: KES {Number(watchedPrincipal || 0).toLocaleString()} + Interest: KES {Number(loanCalculation.interest_amount).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Installment Schedule Preview */}
                        {installmentSchedule.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Calendar className="h-5 w-5" />
                                        Installment Schedule Preview
                                    </CardTitle>
                                    <CardDescription>
                                        {installmentSchedule.length} weekly installments starting from {watchedIssueDate}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-20">#</TableHead>
                                                    <TableHead>Due Date</TableHead>
                                                    <TableHead className="text-right">Principal</TableHead>
                                                    <TableHead className="text-right">Interest</TableHead>
                                                    <TableHead className="text-right">Total</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {installmentSchedule.map((installment) => (
                                                    <TableRow key={installment.installment_number}>
                                                        <TableCell className="font-medium">
                                                            {installment.installment_number}
                                                        </TableCell>
                                                        <TableCell>
                                                            {new Date(installment.due_date).toLocaleDateString()}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            KES {installment.principal_amount.toLocaleString()}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            KES {installment.interest_amount.toLocaleString()}
                                                        </TableCell>
                                                        <TableCell className="text-right font-semibold">
                                                            KES {installment.total_amount.toLocaleString()}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Button 
                            type="submit" 
                            disabled={isSubmitting || !loanCalculation} 
                            className="w-full"
                        >
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isEditMode ? 'Save Changes' : 'Submit for Approval'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

// Form Field Component
const FormField: React.FC<{ 
    label: string; 
    error?: { message?: string }; 
    children: React.ReactNode; 
    required?: boolean; 
}> = ({ label, error, children, required }) => (
    <div className="space-y-2">
        <Label className="flex items-center">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {children}
        {error && <p className="text-sm text-red-500 mt-1">{error.message}</p>}
    </div>
);

export default LoanFormPage;