import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Mail, Phone, MapPin, Building, Save, Key, Camera, Upload, X, Edit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ButtonLoader } from '@/components/ui/loader';

interface ProfileData {
  full_name: string;
  email: string;
  phone_number: string;
  role: string;
  branch: string;
  member_since: string;
  profile_picture_url: string | null;
}

const Profile = () => {
  const { user, userRole } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData>({
    full_name: '',
    email: '',
    phone_number: '',
    role: '',
    branch: '',
    member_since: '',
    profile_picture_url: null
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      // Get branch info if profile has branch_id
      let branchData = null;
      const profileWithExtras = profile as any; // Type assertion to handle dynamic fields
      
      if (profileWithExtras.branch_id) {
        const { data: branch, error: branchError } = await supabase
          .from('branches')
          .select('name')
          .eq('id', profileWithExtras.branch_id)
          .maybeSingle();
        
        if (!branchError) {
          branchData = branch;
        }
      }

      setProfileData({
        full_name: profile.full_name || '',
        email: user.email || '',
        phone_number: profile.phone_number || '',
        profile_picture_url: profile.profile_picture_url || null,
        role: profileWithExtras?.role || 'Not Set',
        branch: branchData?.name || 'Not Assigned',
        member_since: profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }) : 'N/A'
      });

      console.log('Profile data loaded:', {
        full_name: profile.full_name,
        profile_picture_url: profile.profile_picture_url,
        role: profileWithExtras?.role,
        branch: branchData?.name
      });

    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  // Function to refresh profile data
  const refreshProfileData = async () => {
    await fetchProfile();
  };

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          phone_number: profileData.phone_number,
          profile_picture_url: profileData.profile_picture_url
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Profile updated successfully');
      setEditMode(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large', { description: 'Please select an image smaller than 5MB' });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Invalid file type', { description: 'Please select a valid image file' });
      return;
    }

    setUploading(true);
    try {
      // Compress image before upload for faster processing
      const compressedFile = await compressImage(file);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/profile.${fileExt}`;

      // Show upload progress
      toast.loading('Uploading profile picture...', { id: 'upload' });

      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, compressedFile, {
          cacheControl: '0', // Disable caching
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName);

      // Add cache-busting parameter to prevent browser caching
      const timestamp = Date.now();
      const newProfilePictureUrl = `${data.publicUrl}?t=${timestamp}`;
      
      // Update profile data immediately for better UX
      setProfileData(prev => ({ ...prev, profile_picture_url: newProfilePictureUrl }));
      
      // Update the profile in database
      await supabase
        .from('profiles')
        .update({ profile_picture_url: newProfilePictureUrl })
        .eq('id', user.id);

      toast.success('Profile picture updated successfully', { id: 'upload' });
      
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Refresh profile data to ensure consistency
      await refreshProfileData();
      
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload profile picture', { id: 'upload' });
    } finally {
      setUploading(false);
    }
  };

  // Image compression function for faster uploads
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions (max 512x512 for profile pictures)
        const maxSize = 512;
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file); // Fallback to original if compression fails
            }
          },
          'image/jpeg',
          0.8 // 80% quality for good balance of size and quality
        );
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="space-y-6 p-2 sm:p-4 md:p-6">
        <h1 className="text-3xl font-bold text-foreground">Profile</h1>
        <div className="animate-pulse">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-4 bg-muted rounded w-1/4"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-heading-1 text-gray-900">Profile</h1>
          <p className="text-body text-gray-600 mt-1">Manage your account settings and preferences</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setEditMode(!editMode)} className="w-full sm:w-auto">
            {editMode ? (
              <>
                <X className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Cancel Edit</span>
                <span className="sm:hidden">Cancel</span>
              </>
            ) : (
              <>
                <Edit className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Edit Profile</span>
                <span className="sm:hidden">Edit</span>
              </>
            )}
          </Button>
          
          {editMode && (
            <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
              {saving ? (
                <ButtonLoader size="sm" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              <span className="hidden sm:inline">Save Changes</span>
              <span className="sm:hidden">Save</span>
            </Button>
          )}
        </div>
      </div>

      {/* Profile Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Profile Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-heading-3">Basic Information</CardTitle>
              <CardDescription className="text-body text-muted-foreground">
                Your personal details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-body font-medium">Full Name</Label>
                <Input
                  id="full_name"
                  value={profileData.full_name || ''}
                  onChange={(e) => handleInputChange('full_name', e.target.value)}
                  disabled={!editMode}
                  className="text-body"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-body font-medium">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileData.email || ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  disabled={!editMode}
                  className="text-body"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone_number" className="text-body font-medium">Phone Number</Label>
                <Input
                  id="phone_number"
                  value={profileData.phone_number || ''}
                  onChange={(e) => handleInputChange('phone_number', e.target.value)}
                  disabled={!editMode}
                  className="text-body"
                />
              </div>
              

            </CardContent>
          </Card>

          {/* Work Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-heading-3">Work Information</CardTitle>
              <CardDescription className="text-body text-muted-foreground">
                Your role and branch details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="role" className="text-body font-medium">Role</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="role"
                    value={profileData.role.replace('_', ' ').split(' ').map(word => 
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')}
                    disabled
                    className="text-body pl-9 bg-muted"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="branch" className="text-body font-medium">Branch</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="branch"
                    value={profileData.branch}
                    disabled
                    className="text-body pl-9 bg-muted"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="member_since" className="text-body font-medium">Member Since</Label>
                <Input
                  id="member_since"
                  value={profileData.member_since}
                  disabled
                  className="text-body bg-muted"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profile Picture */}
        <Card className="md:col-span-2 bg-gradient-to-br from-brand-green-50 to-brand-green-100 border-brand-green-200 hover:border-brand-green-300 transition-all duration-200 hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-heading-3 text-brand-green-800">
              <Camera className="h-5 w-5 text-brand-green-600" />
              Profile Picture
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
            <div className="relative flex-shrink-0">
              <Avatar className="h-20 w-20 sm:h-24 sm:w-24">
                <AvatarImage 
                  key={profileData.profile_picture_url} // Force re-render when URL changes
                  src={profileData.profile_picture_url} 
                  alt={profileData.full_name}
                  onError={(e) => {
                    console.error('Avatar image failed to load:', profileData.profile_picture_url);
                    console.error('Error event:', e);
                  }}
                  onLoad={() => {
                    console.log('Avatar image loaded successfully:', profileData.profile_picture_url);
                  }}
                />
                <AvatarFallback className="bg-primary/10 text-primary text-lg">
                  {profileData.full_name ? getInitials(profileData.full_name) : <User className="h-8 w-8" />}
                </AvatarFallback>
              </Avatar>
              {uploading && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
              )}
            </div>
            <div className="space-y-4 flex-1 w-full text-center sm:text-left">
              <div>
                <p className="text-body text-muted-foreground mb-3">
                  Upload a new profile picture. Recommended size is 256x256 pixels. Maximum file size: 5MB.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center sm:justify-start">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    <Upload className="h-4 w-4" />
                    <span className="text-body">{uploading ? 'Uploading...' : 'Upload Photo'}</span>
                  </Button>
                  {profileData.profile_picture_url && (
                    <Button 
                      variant="outline" 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center justify-center gap-2 w-full sm:w-auto"
                    >
                      <Camera className="h-4 w-4" />
                      <span className="text-body">Change Photo</span>
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Upload Progress and Tips */}
              {uploading && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-blue-700">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700"></div>
                    <span className="text-sm font-medium">Processing and uploading your image...</span>
                  </div>
                  <p className="text-xs text-blue-600 mt-1 text-center sm:text-left">
                    This may take a few seconds. Please don't close this page.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account Stats */}
      <Card className="md:col-span-2 bg-gradient-to-br from-brand-green-50 to-brand-green-100 border-brand-green-200 hover:border-brand-green-300 transition-all duration-200 hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-heading-3">Account Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
                             <div className="text-heading-1 font-bold text-primary">Active</div>
               <div className="text-caption text-muted-foreground">Account Status</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
                             <div className="text-heading-1 font-bold text-primary">
                 {profileData.member_since !== 'N/A' ? 
                   Math.floor((Date.now() - new Date(profileData.member_since).getTime()) / (1000 * 60 * 60 * 24)) : 
                   'N/A'
                 }
               </div>
               <div className="text-caption text-muted-foreground">Days Active</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
                             <div className="text-heading-1 font-bold text-success">Verified</div>
               <div className="text-caption text-muted-foreground">Email Status</div>
             </div>
             <div className="text-center p-4 border rounded-lg">
               <div className="text-heading-1 font-bold text-primary">Standard</div>
               <div className="text-caption text-muted-foreground">Access Level</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Notice */}
      <Card className="bg-gradient-to-br from-brand-green-50 to-brand-green-100 border-brand-green-200 hover:border-brand-green-300 transition-all duration-200 hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Key className="h-4 w-4" />
            <span>
              For security changes such as password reset or role modifications, please contact your system administrator.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;