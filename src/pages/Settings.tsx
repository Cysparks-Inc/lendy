import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Settings as SettingsIcon, Save, AlertCircle, ShieldAlert, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// --- Type Definition ---
// This matches the structure of our new database table
interface SystemSettings {
  company_name: string;
  company_email: string;
  company_phone: string;
  default_interest_rate: number;
  default_penalty_rate: number;
  max_loan_amount: number;
  min_loan_amount: number;
  loan_term_months: number;
  auto_calculate_interest: boolean;
  email_notifications: boolean;
  sms_notifications: boolean;
  backup_frequency: string;
}

const Settings: React.FC = () => {
  const { userRole } = useAuth();
  const [settings, setSettings] = useState<Partial<SystemSettings>>({});
  const [initialSettings, setInitialSettings] = useState<Partial<SystemSettings>>({});
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (error) throw error;
      
      if (data) {
        setSettings(data);
        setInitialSettings(data); // Store the original state
      }
    } catch (error: any) {
      toast.error('Failed to load system settings', { description: error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userRole === 'super_admin') {
      fetchSettings();
    } else {
      setLoading(false);
    }
  }, [userRole, fetchSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ ...settings, updated_at: new Date().toISOString() })
        .eq('id', 1);

      if (error) throw error;

      toast.success('Settings saved successfully!');
      setInitialSettings(settings); // Update the original state to the new saved state
    } catch (error: any) {
      toast.error('Failed to save settings', { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: keyof SystemSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  // Check if there are any unsaved changes
  const hasChanges = JSON.stringify(settings) !== JSON.stringify(initialSettings);

  if (loading) { return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>; }

  // --- Frontend Access Control ---
  if (userRole !== 'super_admin') {
    return (
      <div className="p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-yellow-500" />
            <CardTitle className="mt-4">Access Denied</CardTitle>
            <CardDescription>Only Super Admins can access the System Settings page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">System Settings</h1>
          <p className="text-muted-foreground">Configure system-wide settings and preferences.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Company Information */}
        <Card>
          <CardHeader><CardTitle>Company Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Company Name"><Input value={settings.company_name || ''} onChange={(e) => handleInputChange('company_name', e.target.value)} /></FormField>
            <FormField label="Company Email"><Input type="email" value={settings.company_email || ''} onChange={(e) => handleInputChange('company_email', e.target.value)} /></FormField>
            <FormField label="Company Phone"><Input value={settings.company_phone || ''} onChange={(e) => handleInputChange('company_phone', e.target.value)} /></FormField>
          </CardContent>
        </Card>

        {/* Loan Configuration */}
        <Card>
          <CardHeader><CardTitle>Loan Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField label="Default Interest Rate (%)"><Input type="number" step="0.1" value={settings.default_interest_rate || 0} onChange={(e) => handleInputChange('default_interest_rate', parseFloat(e.target.value))} /></FormField>
              <FormField label="Default Penalty Rate (%)"><Input type="number" step="0.1" value={settings.default_penalty_rate || 0} onChange={(e) => handleInputChange('default_penalty_rate', parseFloat(e.target.value))} /></FormField>
              <FormField label="Default Loan Term (Months)"><Input type="number" value={settings.loan_term_months || 0} onChange={(e) => handleInputChange('loan_term_months', parseInt(e.target.value))} /></FormField>
              <FormField label="Minimum Loan Amount (KES)"><Input type="number" value={settings.min_loan_amount || 0} onChange={(e) => handleInputChange('min_loan_amount', parseInt(e.target.value))} /></FormField>
              <FormField label="Maximum Loan Amount (KES)"><Input type="number" value={settings.max_loan_amount || 0} onChange={(e) => handleInputChange('max_loan_amount', parseInt(e.target.value))} /></FormField>
            </div>
          </CardContent>
        </Card>

        {/* Automation & Notifications */}
        <Card>
          <CardHeader><CardTitle>Automation & Notifications</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <SwitchField label="Email Notifications" description="Send email notifications for system events" checked={settings.email_notifications || false} onCheckedChange={(checked) => handleInputChange('email_notifications', checked)} />
            <Separator />
            <SwitchField label="SMS Notifications" description="Send SMS notifications to customers" checked={settings.sms_notifications || false} onCheckedChange={(checked) => handleInputChange('sms_notifications', checked)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// --- Helper Components for a cleaner layout ---
const FormField: React.FC<{ label: string; children: React.ReactNode; }> = ({ label, children }) => (
    <div className="space-y-2">
        <Label>{label}</Label>
        {children}
    </div>
);

const SwitchField: React.FC<{ label: string; description: string; checked: boolean; onCheckedChange: (checked: boolean) => void; }> = ({ label, description, checked, onCheckedChange }) => (
    <div className="flex items-center justify-between">
        <div className="space-y-0.5">
            <Label>{label}</Label>
            <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
);

export default Settings;