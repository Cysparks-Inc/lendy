import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Shield, Key, Lock, ShieldAlert, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { ResetPasswordDialog } from '@/components/security/ResetPasswordDialog'; // Import our new component

const Security: React.FC = () => {
  const { userRole } = useAuth();
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  // Note: These settings are UI representations. True enforcement happens in Supabase Auth settings.
  const passwordPolicy = { minLength: 8, requireUppercase: true, requireNumbers: true };
  const sessionPolicy = { timeout: 30, maxAttempts: 5, lockout: 15 };

  if (userRole !== 'super_admin') {
    return (
      <div className="p-2 sm:p-4 md:p-6">
        <Card className="max-w-md mx-auto bg-gradient-to-br from-brand-green-50 to-brand-green-100 border-brand-green-200 hover:border-brand-green-300 transition-all duration-200 hover:shadow-md">
          <CardHeader className="text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-brand-green-600" />
            <CardTitle className="mt-4 text-brand-green-800">Access Denied</CardTitle>
            <CardDescription className="text-brand-green-600">You do not have permission to view this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

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
          <Card className="bg-gradient-to-br from-brand-green-50 to-brand-green-100 border-brand-green-200 hover:border-brand-green-300 transition-all duration-200 hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-brand-green-800 text-lg sm:text-xl">
                <UserCog className="h-4 w-4 sm:h-5 sm:w-5 text-brand-green-600" />
                User Security Actions
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">Perform administrative security actions on user accounts.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border rounded-lg">
                <div className="space-y-2">
                  <p className="font-medium text-sm sm:text-base">Reset a User's Password</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Force a password change for any user account.</p>
                </div>
                <Button onClick={() => setIsResetDialogOpen(true)} className="w-full sm:w-auto">Reset Password</Button>
              </div>
            </CardContent>
          </Card>

          {/* Password Policy */}
          <Card className="bg-gradient-to-br from-brand-green-50 to-brand-green-100 border-brand-green-200 hover:border-brand-green-300 transition-all duration-200 hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-brand-green-800 text-lg sm:text-xl">
                <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-brand-green-600" />
                Password Policy
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">These settings are enforced by Supabase Auth.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-2">
              <InfoItem label="Minimum Length" value={`${passwordPolicy.minLength} characters`} />
              <InfoItem label="Require Uppercase" value={passwordPolicy.requireUppercase ? "Enabled" : "Disabled"} />
              <InfoItem label="Require Numbers" value={passwordPolicy.requireNumbers ? "Enabled" : "Disabled"} />
            </CardContent>
          </Card>
        </div>
      </div>

      <ResetPasswordDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen} />
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