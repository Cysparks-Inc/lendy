import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const MfaEnroll: React.FC = () => {
  const [qr, setQr] = useState<string>('');
  const [totpSecret, setTotpSecret] = useState<string>('');
  const [otpauthUri, setOtpauthUri] = useState<string>('');
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
        // data: { id, type, totp: { qr_code, secret, uri, recovery_codes } }
        setFactorId(data.id);
        setQr(data.totp.qr_code || data.totp.qr_code_url || data.totp.uri || '');
        setTotpSecret(data.totp.secret || '');
        setOtpauthUri(data.totp.uri || '');
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

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch (e: any) {
      toast.error('Copy failed', { description: e?.message || 'Unable to copy to clipboard' });
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

          {(totpSecret || otpauthUri) && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">Can't scan the QR? On the same device, tap the button below or enter the secret manually.</div>

              {otpauthUri && (
                <div className="flex items-center gap-2">
                  <a href={otpauthUri} className="inline-flex items-center justify-center px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 text-sm">
                    Add to Authenticator
                  </a>
                  <Button type="button" variant="outline" size="sm" onClick={() => copyToClipboard(otpauthUri, 'Setup link')}>
                    Copy setup link
                  </Button>
                </div>
              )}

              {totpSecret && (
                <div>
                  <Label>Manual entry key</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="text-sm font-mono px-2 py-1 rounded border break-all">
                      {totpSecret}
                    </code>
                    <Button type="button" variant="outline" size="sm" onClick={() => copyToClipboard(totpSecret, 'Secret key')}>
                      Copy
                    </Button>
                  </div>
                </div>
              )}
            </div>
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


