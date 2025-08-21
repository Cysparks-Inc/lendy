import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Mail, Phone, MapPin, Building, Save, Key, Camera, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProfileData {
  full_name: string;
  email: string;
  phone_number: string;
  branch_name: string;
  role: string;
  created_at: string;
  profile_picture_url: string;
}

const Profile = () => {
  const { user, userRole } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData>({
    full_name: '',
    email: '',
    phone_number: '',
    branch_name: '',
    role: '',
    created_at: '',
    profile_picture_url: ''
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
      // Fetch user profile with branch and role information
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      // Fetch user role and branch
      const { data: roleData, error: roleError } = await supabase
        .from('user_branch_roles')
        .select(`
          role,
          branches:branch_id (name)
        `)
        .eq('user_id', user.id)
        .single();

      if (roleError && roleError.code !== 'PGRST116') {
        console.error('Error fetching role data:', roleError);
      }

      setProfileData({
        full_name: profile.full_name,
        email: profile.email,
        phone_number: profile.phone_number || '',
        branch_name: roleData?.branches?.name || 'No Branch Assigned',
        role: roleData?.role || 'No Role Assigned',
        created_at: profile.created_at,
        profile_picture_url: profile.profile_picture_url || ''
      });
      
      // Debug logging
      console.log('Profile data loaded:', {
        full_name: profile.full_name,
        profile_picture_url: profile.profile_picture_url,
        role: roleData?.role,
        branch: roleData?.branches?.name
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
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
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName);

      // Update profile data immediately for better UX
      const newProfilePictureUrl = data.publicUrl;
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
      
      // Force a re-render to ensure the image displays
      setTimeout(() => {
        setProfileData(prev => ({ ...prev }));
      }, 100);
      
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
          <p className="text-muted-foreground">Manage your account information and settings</p>
        </div>
        <div className="flex gap-2">
          {editMode ? (
            <>
              <Button variant="outline" onClick={() => setEditMode(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <Button onClick={() => setEditMode(true)}>
              Edit Profile
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Picture */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Profile Picture
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage 
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
            <div className="space-y-4 flex-1">
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  Upload a new profile picture. Recommended size is 256x256 pixels. Maximum file size: 5MB.
                </p>
                <div className="flex gap-2">
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
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {uploading ? 'Uploading...' : 'Upload Photo'}
                  </Button>
                  {profileData.profile_picture_url && (
                    <Button 
                      variant="outline" 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-2"
                    >
                      <Camera className="h-4 w-4" />
                      Change Photo
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Upload Progress and Tips */}
              {uploading && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-700">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700"></div>
                    <span className="text-sm font-medium">Processing and uploading your image...</span>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    This may take a few seconds. Please don't close this page.
                  </p>
                </div>
              )}
              
              {/* Remove the success notification - it's not needed */}
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={profileData.full_name}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
                disabled={!editMode}
                className={editMode ? '' : 'bg-muted'}
              />
            </div>
            
            <div>
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  value={profileData.email}
                  disabled
                  className="pl-9 bg-muted"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Email cannot be changed. Contact administrator if needed.
              </p>
            </div>

            <div>
              <Label htmlFor="phone_number">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone_number"
                  value={profileData.phone_number}
                  onChange={(e) => handleInputChange('phone_number', e.target.value)}
                  disabled={!editMode}
                  className={editMode ? 'pl-9' : 'pl-9 bg-muted'}
                  placeholder="+254 XXX XXX XXX"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Work Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Work Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="role">Role</Label>
              <div className="relative">
                <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="role"
                  value={profileData.role.replace('_', ' ').split(' ').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1)
                  ).join(' ')}
                  disabled
                  className="pl-9 bg-muted"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="branch">Branch</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="branch"
                  value={profileData.branch_name}
                  disabled
                  className="pl-9 bg-muted"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="created_at">Member Since</Label>
              <Input
                id="created_at"
                value={new Date(profileData.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
                disabled
                className="bg-muted"
              />
            </div>
          </CardContent>
        </Card>

        {/* Account Stats */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Account Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-primary">Active</div>
                <div className="text-sm text-muted-foreground">Account Status</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-primary">
                  {Math.floor((Date.now() - new Date(profileData.created_at).getTime()) / (1000 * 60 * 60 * 24))}
                </div>
                <div className="text-sm text-muted-foreground">Days Active</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-success">Verified</div>
                <div className="text-sm text-muted-foreground">Email Status</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-primary">Standard</div>
                <div className="text-sm text-muted-foreground">Access Level</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Notice */}
      <Card>
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