import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const MfaEnroll: React.FC = () => {
  const [qr, setQr] = useState<string>('');
  const [verifyCode, setVerifyCode] = useState('');
  const [factorId, setFactorId] = useState<string>('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const start = async () => {
      setLoading(true);
      try {
        // Create a TOTP factor
        const { data, error } = await (supabase as any).auth.mfa.enroll({ factorType: 'totp' });
        if (error) throw error;
        // data: { id, type, totp: { qr_code, secret, uri } }
        setFactorId(data.id);
        setQr(data.totp.qr_code || data.totp.qr_code_url || data.totp.uri || '');
        setRecoveryCodes(data.totp.recovery_codes || []);
      } catch (e: any) {
        toast.error('Failed to start TOTP enrollment', { description: e.message });
      } finally {
        setLoading(false);
      }
    };
    start();
  }, []);

  const handleVerify = async () => {
    if (!factorId || !verifyCode) {
      toast.error('Enter the 6-digit code from your authenticator app');
      return;
    }
    setLoading(true);
    try {
      // Some SDKs require a challenge first; try challenge+verify
      const { data: ch } = await (supabase as any).auth.mfa.challenge({ factorId });
      const { error } = await (supabase as any).auth.mfa.verify({ factorId, code: verifyCode, challengeId: ch?.id });
      if (error) throw error;
      toast.success('TOTP enrolled successfully');
      window.location.href = '/';
    } catch (e: any) {
      toast.error('Verification failed', { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Set up Authenticator (TOTP)</CardTitle>
          <CardDescription>Scan the QR with Google Authenticator, 1Password, Authy, etc.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {qr ? (
            <img src={qr} alt="TOTP QR" className="mx-auto w-56 h-56" />
          ) : (
            <div className="text-center text-sm text-muted-foreground">Generating QR...</div>
          )}

          <div className="space-y-2">
            <Label>Enter 6-digit code</Label>
            <Input value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} placeholder="123456" />
            <Button onClick={handleVerify} disabled={loading} className="w-full">Verify & Enable</Button>
          </div>

          {recoveryCodes.length > 0 && (
            <div className="mt-4">
              <Label>Recovery Codes</Label>
              <ul className="text-xs mt-2 grid grid-cols-2 gap-2">
                {recoveryCodes.map((c) => (
                  <li key={c} className="font-mono p-1 border rounded">{c}</li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-2">Store these somewhere safe. They can be used if you lose your device.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MfaEnroll;


