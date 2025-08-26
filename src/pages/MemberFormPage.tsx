import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, PlusCircle, Trash2, ArrowLeft, CheckCircle, UserPlus } from 'lucide-react';
import { ImageUploader } from '@/components/ui/ImageUploader';

// --- Validation Schema with Zod ---
const nextOfKinSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  relationship: z.string().min(1, "Relationship is required"),
  contact_number: z.string().optional().default(''),
});

const memberSchema = z.object({
  photo_url: z.string().optional().default(''),
  full_name: z.string().min(3, "Full name must be at least 3 characters"),
  dob: z.string().optional().default(''),
  sex: z.string().optional().default(''),
  phone_number: z.string().min(10, "A valid phone number is required"),
  marital_status: z.string().optional().default(''),
  spouse_dob: z.string().optional().default(''),
  kyc_id_type: z.string().min(1, "KYC ID type is required"),
  id_number: z.string().min(5, "A valid ID number is required"),
  kra_pin: z.string().optional().default(''),
  address_1: z.string().optional().default(''),
  location: z.string().optional().default(''),
  house_type: z.string().optional().default(''),
  profession: z.string().optional().default(''),
  monthly_income: z.preprocess(val => (val === '' || val === null) ? 0 : Number(val), z.number().min(0).optional().default(0)),
  branch_id: z.string().min(1, "Branch is required"),
  group_id: z.string().optional().default('none'), // Optional group assignment
  // Officer assignment is now mandatory
  assigned_officer_id: z.string().min(1, "Assigning an officer is required"),
  next_of_kin: z.array(nextOfKinSchema).optional(),
});

type MemberFormData = z.infer<typeof memberSchema>;
type Branch = { id: number; name: string; };
type AssignableOfficer = { id: string; full_name: string; };
type Group = { id: string; name: string; branch_id: string; };

const relationshipOptions = ["Spouse", "Parent", "Sibling", "Child", "Guardian", "Other"];

const sanitizeDataForForm = (data: any) => {
  const sanitized = { ...data };
  for (const key in memberSchema.shape) { if (sanitized[key] === null) { sanitized[key] = ''; } }
  if (!sanitized.next_of_kin || sanitized.next_of_kin.length === 0) {
    sanitized.next_of_kin = [{ full_name: '', relationship: '', contact_number: '' }];
  } else {
    sanitized.next_of_kin = sanitized.next_of_kin.map((nok: any) => ({ ...nok, contact_number: nok.contact_number || '' }));
  }
  return sanitized;
};

const MemberFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user, userRole } = useAuth();
    const isEditMode = Boolean(id);
    
    const [branches, setBranches] = useState<Branch[]>([]);
    const [assignableOfficers, setAssignableOfficers] = useState<AssignableOfficer[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [successData, setSuccessData] = useState<{ id: string; name: string } | null>(null);
    const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);

    const { register, handleSubmit, control, reset, watch, setValue, formState: { errors } } = useForm<MemberFormData>({
        resolver: zodResolver(memberSchema),
        defaultValues: { next_of_kin: [] }
    });

    const { fields, append, remove } = useFieldArray({ control, name: "next_of_kin" });

    useEffect(() => {
        const fetchData = async () => {
            setLoadingData(true);
            try {
                // Query now includes all roles that can be assigned a member and groups
                const [branchesRes, officersRes, groupsRes] = await Promise.all([
                    supabase.from('branches').select('id, name'),
                    supabase.from('profiles').select('id, full_name').in('role', ['loan_officer', 'branch_admin', 'super_admin']),
                    supabase.from('groups').select('id, name, branch_id')
                ]);
                setBranches(branchesRes.data || []);
                setAssignableOfficers(officersRes.data || []);
                setGroups(groupsRes.data || []);

                if (isEditMode && id) {
                    const { data: memberData, error } = await supabase.from('members').select('*, next_of_kin(*)').eq('id', id).single();
                    if (error) throw error;
                    if (memberData) {
                        const sanitizedData = sanitizeDataForForm(memberData);
                        reset({ ...sanitizedData, branch_id: String(sanitizedData.branch_id), monthly_income: String(sanitizedData.monthly_income || '') });
                    }
                } else {
                    reset({ next_of_kin: [{ full_name: '', relationship: '', contact_number: '' }] });
                }
            } catch (error: any) {
                toast.error("Failed to load necessary data", { description: error.message });
            } finally {
                setLoadingData(false);
            }
        };
        fetchData();
    }, [id, isEditMode, reset]);

    // Filter groups based on selected branch
    const selectedBranchId = watch("branch_id");
    useEffect(() => {
        if (selectedBranchId) {
            const branchGroups = groups.filter(group => group.branch_id === selectedBranchId);
            setFilteredGroups(branchGroups);
        } else {
            setFilteredGroups([]);
        }
        // Clear group selection if branch changes
        if (selectedBranchId) {
            setValue("group_id", "none");
        }
    }, [selectedBranchId, groups, setValue]);

    const onSubmit = async (data: MemberFormData) => {
        setIsSubmitting(true);
        setFormError(null);
        try {
            let pictureUrl = data.photo_url;

            if (profilePictureFile) {
                const filePath = `public/${user?.id}-${Date.now()}`;
                const { error: uploadError } = await supabase.storage.from('member-avatars').upload(filePath, profilePictureFile);
                if (uploadError) throw uploadError;
                
                const { data: urlData } = supabase.storage.from('member-avatars').getPublicUrl(filePath);
                pictureUrl = urlData.publicUrl;
            }

            const { next_of_kin, ...memberData } = data;
            if (memberData.dob === '') memberData.dob = null;
            if (memberData.spouse_dob === '') memberData.spouse_dob = null;
            
            // If the current user is a loan officer, they are forced to be the assignee.
            // Otherwise, we use the value from the (now mandatory) dropdown.
            const assignedOfficer = userRole === 'loan_officer' ? user?.id : (data.assigned_officer_id || null);

            const finalMemberData = {
                ...memberData,
                photo_url: pictureUrl,
                branch_id: Number(data.branch_id),
                group_id: data.group_id === 'none' ? null : data.group_id || null, // Include group assignment
                assigned_officer_id: assignedOfficer,
                created_by: user?.id
            };

            let memberId = id;
            if (isEditMode) {
                const { error } = await supabase.from('members').update(finalMemberData).eq('id', id);
                if (error) throw error;
            } else {
                const { data: newMember, error } = await supabase.from('members').insert(finalMemberData).select('id').single();
                if (error) throw error;
                memberId = newMember.id;
            }

            if (next_of_kin && memberId) {
                await supabase.from('next_of_kin').delete().eq('member_id', memberId);
                const nokData = next_of_kin.filter(nok => nok.full_name).map(nok => ({ ...nok, member_id: memberId }));
                if (nokData.length > 0) {
                    const { error: nokError } = await supabase.from('next_of_kin').insert(nokData);
                    if (nokError) throw nokError;
                }
            }
            toast.success(`Member ${isEditMode ? 'updated' : 'created'} successfully!`);
            setSuccessData({ id: memberId!, name: data.full_name });
        } catch (error: any) {
            const errorMessage = error.message.includes('duplicate key') ? 'A member with this ID or Phone Number already exists.' : error.message;
            setFormError(errorMessage);
            toast.error('Operation Failed', { description: errorMessage });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleAddAnother = () => {
        reset({ next_of_kin: [{ full_name: '', relationship: '', contact_number: '' }] });
        setSuccessData(null);
        setProfilePictureFile(null);
    };

    if (loadingData) { return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>; }

    if (successData) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-2 sm:p-4 md:p-6 text-center">
                <Card className="max-w-md bg-gradient-to-br from-brand-green-50 to-brand-green-100 border-brand-green-200 hover:border-brand-green-300 transition-all duration-200 hover:shadow-md">
                    <CardHeader>
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-green-100">
                            <CheckCircle className="h-6 w-6 text-brand-green-600" />
                        </div>
                        <CardTitle className="mt-4 text-brand-green-800">Success!</CardTitle>
                        <CardDescription className="text-brand-green-600">Member "{successData.name}" has been saved.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        <Button asChild><Link to={`/members/${successData.id}`}>View Member Profile</Link></Button>
                        <Button variant="outline" onClick={handleAddAnother}><UserPlus className="mr-2 h-4 w-4" />Add Another Member</Button>
                        <Button variant="ghost" asChild><Link to="/members">Back to Members List</Link></Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-2 sm:p-4 md:p-6 max-w-5xl mx-auto">
            <Button asChild variant="outline" size="sm" className="mb-4"><Link to="/members"><ArrowLeft className="mr-2 h-4 w-4" />Back to Members</Link></Button>
            <form onSubmit={handleSubmit(onSubmit)}>
                <Card className="bg-gradient-to-br from-brand-green-50 to-brand-green-100 border-brand-green-200 hover:border-brand-green-300 transition-all duration-200 hover:shadow-md">
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold text-brand-green-800">
                            {isEditMode ? 'Edit Member' : 'Add New Member'}
                        </CardTitle>
                        <CardDescription className="text-brand-green-600">
                            {isEditMode 
                                ? 'Update member information below.' 
                                : userRole === 'loan_officer'
                                    ? 'Register a new member who will be automatically assigned to you.'
                                    : 'Fill in the details below to register a new member.'
                            }
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        {formError && <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>}

                        <FormSection title="Profile Picture">
                            <ImageUploader currentImageUrl={watch("photo_url")} onImageSelect={setProfilePictureFile} />
                        </FormSection>

                        <FormSection title="Personal Details">
                            <FormField label="Full Name" error={errors.full_name} required><Input {...register("full_name")} /></FormField>
                            <FormField label="Date of Birth" error={errors.dob}><Input type="date" {...register("dob")} /></FormField>
                            <FormField label="Sex" error={errors.sex}><Controller name="sex" control={control} render={({ field }) => <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Select sex..." /></SelectTrigger><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent></Select>} /></FormField>
                            <FormField label="Phone Number" error={errors.phone_number} required><Input {...register("phone_number")} /></FormField>
                            <FormField label="Marital Status" error={errors.marital_status}><Controller name="marital_status" control={control} render={({ field }) => <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Select status..." /></SelectTrigger><SelectContent><SelectItem value="Single">Single</SelectItem><SelectItem value="Married">Married</SelectItem><SelectItem value="Divorced">Divorced</SelectItem><SelectItem value="Widowed">Widowed</SelectItem></SelectContent></Select>} /></FormField>
                            {watch("marital_status") === "Married" && <FormField label="Spouse Date of Birth" error={errors.spouse_dob}><Input type="date" {...register("spouse_dob")} /></FormField>}
                        </FormSection>

                        <FormSection title="KYC & Financial Information">
                            <FormField label="KYC ID Type" error={errors.kyc_id_type} required><Controller name="kyc_id_type" control={control} render={({ field }) => <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Select ID type..." /></SelectTrigger><SelectContent><SelectItem value="National ID">National ID</SelectItem><SelectItem value="Passport">Passport</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select>} /></FormField>
                            <FormField label="ID Number" error={errors.id_number} required><Input {...register("id_number")} /></FormField>
                            <FormField label="KRA PIN (Optional)" error={errors.kra_pin}><Input {...register("kra_pin")} /></FormField>
                            <FormField label="Profession" error={errors.profession}><Input {...register("profession")} /></FormField>
                            <FormField label="Monthly Income (KES, Optional)" error={errors.monthly_income}><Input type="number" {...register("monthly_income")} /></FormField>
                        </FormSection>

                        <FormSection title="Address & Housing">
                            <FormField label="Location / Estate" error={errors.location}><Input {...register("location")} /></FormField>
                            <FormField label="Address" error={errors.address_1}><Input {...register("address_1")} /></FormField>
                            <FormField label="House Type" error={errors.house_type}><Input {...register("house_type")} /></FormField>
                        </FormSection>

                        <div>
                            <h3 className="text-lg font-medium">Next of Kin</h3>
                            <div className="space-y-4 mt-4">
                                {fields.map((field, index) => (
                                    <div key={field.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg relative">
                                        <FormField label="Full Name" error={errors.next_of_kin?.[index]?.full_name} required><Input {...register(`next_of_kin.${index}.full_name`)} /></FormField>
                                        <FormField label="Relationship" error={errors.next_of_kin?.[index]?.relationship} required><Controller name={`next_of_kin.${index}.relationship`} control={control} render={({ field }) => <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{relationshipOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select>} /></FormField>
                                        <FormField label="Contact Number" error={errors.next_of_kin?.[index]?.contact_number}><Input {...register(`next_of_kin.${index}.contact_number`)} /></FormField>
                                        <div className="md:col-start-4 flex items-end">{fields.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-red-500" /></Button>}</div>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" size="sm" onClick={() => append({ full_name: '', relationship: '', contact_number: '' })}><PlusCircle className="mr-2 h-4 w-4" />Add Next of Kin</Button>
                            </div>
                        </div>

                        <FormSection title={userRole === 'loan_officer' ? 'Branch & Group Assignment' : 'Branch, Group & Officer Assignment'}>
                            <FormField label="Branch" error={errors.branch_id} required><Controller name="branch_id" control={control} render={({ field }) => <Select onValueChange={field.onChange} value={String(field.value || '')}><SelectTrigger><SelectValue placeholder="Assign a branch..." /></SelectTrigger><SelectContent>{branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}</SelectContent></Select>} /></FormField>
                            <FormField label="Group (Optional)" error={errors.group_id}>
                                <Controller name="group_id" control={control} render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedBranchId}>
                                        <SelectTrigger><SelectValue placeholder={selectedBranchId ? "Select a group..." : "Select branch first"} /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No Group</SelectItem>
                                            {filteredGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )} />
                            </FormField>
                            {userRole !== 'loan_officer' && (
                                <FormField label="Assign to Officer" error={errors.assigned_officer_id} required>
                                    <Controller name="assigned_officer_id" control={control} render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger><SelectValue placeholder="Select an officer..." /></SelectTrigger>
                                            <SelectContent>{assignableOfficers.map(o => <SelectItem key={o.id} value={o.id}>{o.full_name}</SelectItem>)}</SelectContent>
                                        </Select>
                                    )} />
                                </FormField>
                            )}
                            {userRole === 'loan_officer' && (
                                <div className="col-span-full">
                                    <Alert className="bg-brand-green-50 border-brand-green-200 text-brand-green-800">
                                        <AlertDescription>
                                            <strong>Note:</strong> New members you create will be automatically assigned to you as their loan officer.
                                        </AlertDescription>
                                    </Alert>
                                </div>
                            )}
                        </FormSection>

                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isEditMode ? 'Save Changes' : 'Create Member'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
};

const FormSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div><h3 className="text-lg font-medium">{title}</h3><Separator className="my-4" /><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">{children}</div></div>
);

const FormField: React.FC<{ label: string; error?: { message?: string }; children: React.ReactNode; required?: boolean; }> = ({ label, error, children, required }) => (
    <div className="space-y-2"><Label className="flex items-center">{label}{required && <span className="text-red-500 ml-1">*</span>}</Label>{children}{error && <p className="text-sm text-red-500 mt-1">{error.message}</p>}</div>
);

export default MemberFormPage;