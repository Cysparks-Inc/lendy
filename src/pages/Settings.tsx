import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Settings as SettingsIcon, Save, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

const Settings = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    company_name: 'Napol Microfinance',
    company_email: 'info@napol.co.ke',
    company_phone: '+254 700 000 000',
    default_interest_rate: 2.5,
    default_penalty_rate: 5.0,
    max_loan_amount: 1000000,
    min_loan_amount: 5000,
    loan_term_months: 12,
    auto_calculate_interest: true,
    email_notifications: true,
    sms_notifications: false,
    backup_frequency: 'daily'
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Simulate saving settings
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof SystemSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">System Settings</h1>
          <p className="text-muted-foreground">Configure system-wide settings and preferences</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              Company Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  value={settings.company_name}
                  onChange={(e) => handleInputChange('company_name', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="company_email">Company Email</Label>
                <Input
                  id="company_email"
                  type="email"
                  value={settings.company_email}
                  onChange={(e) => handleInputChange('company_email', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="company_phone">Company Phone</Label>
                <Input
                  id="company_phone"
                  value={settings.company_phone}
                  onChange={(e) => handleInputChange('company_phone', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loan Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Loan Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="default_interest_rate">Default Interest Rate (%)</Label>
                <Input
                  id="default_interest_rate"
                  type="number"
                  step="0.1"
                  value={settings.default_interest_rate}
                  onChange={(e) => handleInputChange('default_interest_rate', parseFloat(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="default_penalty_rate">Default Penalty Rate (%)</Label>
                <Input
                  id="default_penalty_rate"
                  type="number"
                  step="0.1"
                  value={settings.default_penalty_rate}
                  onChange={(e) => handleInputChange('default_penalty_rate', parseFloat(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="loan_term_months">Default Loan Term (Months)</Label>
                <Input
                  id="loan_term_months"
                  type="number"
                  value={settings.loan_term_months}
                  onChange={(e) => handleInputChange('loan_term_months', parseInt(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="min_loan_amount">Minimum Loan Amount (KES)</Label>
                <Input
                  id="min_loan_amount"
                  type="number"
                  value={settings.min_loan_amount}
                  onChange={(e) => handleInputChange('min_loan_amount', parseInt(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="max_loan_amount">Maximum Loan Amount (KES)</Label>
                <Input
                  id="max_loan_amount"
                  type="number"
                  value={settings.max_loan_amount}
                  onChange={(e) => handleInputChange('max_loan_amount', parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-Calculate Interest</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically calculate daily interest on loans
                </p>
              </div>
              <Switch
                checked={settings.auto_calculate_interest}
                onCheckedChange={(checked) => handleInputChange('auto_calculate_interest', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Notification Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Send email notifications for system events
                </p>
              </div>
              <Switch
                checked={settings.email_notifications}
                onCheckedChange={(checked) => handleInputChange('email_notifications', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>SMS Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Send SMS notifications to customers
                </p>
              </div>
              <Switch
                checked={settings.sms_notifications}
                onCheckedChange={(checked) => handleInputChange('sms_notifications', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* System Maintenance */}
        <Card>
          <CardHeader>
            <CardTitle>System Maintenance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="backup_frequency">Backup Frequency</Label>
              <Select value={settings.backup_frequency} onValueChange={(value) => handleInputChange('backup_frequency', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
              <AlertCircle className="h-4 w-4 text-warning" />
              <div>
                <p className="text-sm font-medium">System Status</p>
                <p className="text-sm text-muted-foreground">All systems operational</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <p className="text-sm font-medium">Database Size</p>
                <p className="text-2xl font-bold text-primary">45.7 MB</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm font-medium">Last Backup</p>
                <p className="text-2xl font-bold text-success">2 hours ago</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;