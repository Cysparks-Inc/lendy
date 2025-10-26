import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Shield, Key, Lock, ShieldAlert, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { ResetPasswordDialog } from '@/components/security/ResetPasswordDialog'; // Import our new component
import { DisableMfaDialog } from '@/components/security/DisableMfaDialog'; // Import MFA disable component
import { Link } from 'react-router-dom';

const Security: React.FC = () => {
  const { userRole, user, profile } = useAuth();
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isDisableMfaDialogOpen, setIsDisableMfaDialogOpen] = useState(false);

  // Note: These settings are UI representations. True enforcement happens in Supabase Auth settings.
  const passwordPolicy = { minLength: 8, requireUppercase: true, requireNumbers: true };
  const sessionPolicy = { timeout: 30, maxAttempts: 5, lockout: 15 };

  // Page is now accessible to all authenticated users

  return (
    <>
      <div className="space-y-6 p-2 sm:p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Security</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Manage security policies and user access.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* User Security Actions */}
          <Card className="bg-gradient-to-br from-brand-blue-50 to-brand-blue-100 border-brand-blue-200 hover:border-brand-blue-300 transition-all duration-200 hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-brand-blue-800 text-lg sm:text-xl">
                <UserCog className="h-4 w-4 sm:h-5 sm:w-5 text-brand-blue-600" />
                {userRole === 'super_admin' ? 'Admin Security Actions' : 'Your Security'}
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                {userRole === 'super_admin' ? 'Perform administrative security actions on user accounts.' : 'Manage your personal security settings.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userRole === 'super_admin' ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border rounded-lg">
                    <div className="space-y-2">
                      <p className="font-medium text-sm sm:text-base">Reset a User's Password</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Force a password change for any user account.</p>
                    </div>
                    <Button onClick={() => setIsResetDialogOpen(true)} className="w-full sm:w-auto">Reset Password</Button>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border rounded-lg">
                    <div className="space-y-2">
                      <p className="font-medium text-sm sm:text-base">Disable User MFA</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Remove MFA enrollment for a user so they can re-enroll.</p>
                    </div>
                    <Button onClick={() => setIsDisableMfaDialogOpen(true)} variant="destructive" className="w-full sm:w-auto">Disable MFA</Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border rounded-lg">
                  <div className="space-y-2">
                    <p className="font-medium text-sm sm:text-base">Change Your Password</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Update the password for your account.</p>
                  </div>
                  <Button onClick={() => setIsResetDialogOpen(true)} className="w-full sm:w-auto">Change Password</Button>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border rounded-lg mt-4">
                <div className="space-y-2">
                  <p className="font-medium text-sm sm:text-base">MFA Security</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Enroll or manage authenticator app settings.</p>
                </div>
                <Link to="/security/mfa"><Button variant="secondary" className="w-full sm:w-auto">Open MFA Settings</Button></Link>
              </div>
            </CardContent>
          </Card>

          {/* Password Policy */}
          <Card className="bg-gradient-to-br from-brand-blue-50 to-brand-blue-100 border-brand-blue-200 hover:border-brand-blue-300 transition-all duration-200 hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-brand-blue-800 text-lg sm:text-xl">
                <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-brand-blue-600" />
                Password Policy
              </CardTitle>
             
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-2">
              <InfoItem label="Minimum Length" value={`${passwordPolicy.minLength} characters`} />
              <InfoItem label="Require Uppercase" value={passwordPolicy.requireUppercase ? "Enabled" : "Disabled"} />
              <InfoItem label="Require Numbers" value={passwordPolicy.requireNumbers ? "Enabled" : "Disabled"} />
            </CardContent>
          </Card>
        </div>
      </div>

      <ResetPasswordDialog 
        open={isResetDialogOpen} 
        onOpenChange={setIsResetDialogOpen} 
        mode={userRole === 'super_admin' ? 'admin' : 'self'}
        selfUser={{ id: user?.id || '', full_name: profile?.full_name || user?.user_metadata?.full_name || null, email: user?.email || null }}
      />

      <DisableMfaDialog 
        open={isDisableMfaDialogOpen} 
        onOpenChange={setIsDisableMfaDialogOpen} 
      />
    </>
  );
};

const InfoItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
        <p className="text-xs sm:text-sm text-muted-foreground">{label}</p>
        <p className="text-sm sm:text-base font-medium">{value}</p>
    </div>
);

export default Security;