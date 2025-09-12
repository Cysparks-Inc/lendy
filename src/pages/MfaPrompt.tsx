import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const MfaPrompt: React.FC = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState<string>('');
  const [challengeId, setChallengeId] = useState<string>('');
  const [usingEmail, setUsingEmail] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        // Load verified/enrolled TOTP factor for this user
        const { data, error } = await (supabase as any).auth.mfa.listFactors();
        if (error) throw error;
        const totp = (data?.totp || []).find((f: any) => ['verified', 'enrolled'].includes(f.status));
        if (!totp) return;
        setFactorId(totp.id);
        // Start a challenge for login verification
        const { data: ch, error: chErr } = await (supabase as any).auth.mfa.challenge({ factorId: totp.id });
        if (chErr) throw chErr;
        setChallengeId(ch.id);
      } catch (e) {
        // silent; UI fallback via email can be used
      }
    };
    bootstrap();
  }, []);

  const verifyTOTP = async () => {
    if (!code) return toast.error('Enter the 6-digit code');
    setLoading(true);
    try {
      if (!factorId) throw new Error('No TOTP factor found for this account');
      const payload: any = { factorId, code };
      if (challengeId) payload.challengeId = challengeId;
      const { error } = await (supabase as any).auth.mfa.verify(payload);
      if (error) throw error;
      toast.success('Verification successful');
      // Mark MFA as verified for this user for the current session window
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (userId) {
        const key = `mfa_verified_${userId}`;
        // Set to expire in 12 hours; adjust as needed
        const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
        localStorage.setItem(key, JSON.stringify({ expiresAt }));
      }
      window.location.href = '/';
    } catch (e: any) {
      toast.error('Invalid code', { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const sendEmailOtp = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const email = session?.session?.user?.email;
      if (!email) throw new Error('No email');
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (error) throw error;
      setUsingEmail(true);
      toast.success('OTP sent to your email');
    } catch (e: any) {
      toast.error('Failed to send OTP', { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const verifyEmailOtp = async () => {
    if (!code) return toast.error('Enter the email OTP');
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const email = session?.session?.user?.email;
      if (!email) throw new Error('No email');
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' as any });
      if (error) throw error;
      toast.success('Verification successful');
      // Mark MFA as verified for this user for the current session window
      const { data: s2 } = await supabase.auth.getSession();
      const userId = s2?.session?.user?.id;
      if (userId) {
        const key = `mfa_verified_${userId}`;
        const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
        localStorage.setItem(key, JSON.stringify({ expiresAt }));
      }
      window.location.href = '/';
    } catch (e: any) {
      toast.error('Invalid OTP', { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Two‑Factor Verification</CardTitle>
          <CardDescription>Enter the 6‑digit code from your authenticator app. Or use email OTP.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!factorId && !usingEmail && (
            <div className="text-sm p-3 rounded border bg-muted/30">
              It looks like you haven’t enrolled in an authenticator yet. You can
              <Link to="/mfa/enroll" className="underline ml-1">set up TOTP</Link>
              
               now, or use email OTP below.
            </div>
          )}
          <div className="space-y-2">
            <Label>Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={usingEmail ? 'Email OTP' : '123456'} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={usingEmail ? verifyEmailOtp : verifyTOTP} disabled={loading}>{usingEmail ? 'Verify Email OTP' : 'Verify TOTP'}</Button>
            <Button variant="outline" onClick={sendEmailOtp} disabled={loading}>Use Email OTP</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MfaPrompt;


