import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const SecurityMfa: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [hasTotp, setHasTotp] = useState(false);
  const [factors, setFactors] = useState<any[]>([]);

  const refreshFactors = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).auth.mfa.listFactors();
      if (error) throw error;
      const totps = data?.totp || [];
      setFactors(totps);
      setHasTotp(totps.some((f: any) => ['verified', 'enrolled'].includes(f.status)));
    } catch (e: any) {
      toast.error('Failed to load MFA status', { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshFactors();
  }, []);

  const disableTotp = async (factorId: string) => {
    setLoading(true);
    try {
      const { error } = await (supabase as any).auth.mfa.unenroll({ factorId });
      if (error) throw error;
      toast.success('Authenticator disabled');
      await refreshFactors();
    } catch (e: any) {
      toast.error('Failed to disable', { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>MFA Security</CardTitle>
          <CardDescription>Manage your authenticator app (TOTP) and MFA options.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded">
            <div>
              <div className="font-medium">Authenticator (TOTP)</div>
              <div className="text-sm text-muted-foreground">Status: {hasTotp ? 'Enabled' : 'Not enabled'}</div>
            </div>
            {hasTotp ? (
              <Button variant="destructive" disabled={loading} onClick={() => factors[0]?.id && disableTotp(factors[0].id)}>Disable</Button>
            ) : (
              <Link to="/mfa/enroll"><Button disabled={loading}>Enable</Button></Link>
            )}
          </div>

          <Separator />

          <div className="text-sm text-muted-foreground">
            You can also verify at sign-in from the
            <Link to="/mfa" className="underline ml-1">MFA Prompt</Link> page.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SecurityMfa;


