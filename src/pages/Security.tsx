import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Shield, Key, AlertTriangle, Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SecuritySettings {
  password_min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_numbers: boolean;
  require_special_chars: boolean;
  session_timeout: number;
  max_login_attempts: number;
  lockout_duration: number;
  two_factor_enabled: boolean;
  audit_logging: boolean;
}

interface SecurityEvent {
  id: string;
  timestamp: string;
  user_email: string;
  event_type: string;
  ip_address: string;
  status: 'success' | 'failed' | 'blocked';
  details: string;
}

const Security = () => {
  const [settings, setSettings] = useState<SecuritySettings>({
    password_min_length: 8,
    require_uppercase: true,
    require_lowercase: true,
    require_numbers: true,
    require_special_chars: false,
    session_timeout: 30,
    max_login_attempts: 5,
    lockout_duration: 15,
    two_factor_enabled: false,
    audit_logging: true
  });

  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([
    {
      id: '1',
      timestamp: '2024-01-20 14:30:22',
      user_email: 'admin@napol.co.ke',
      event_type: 'Login',
      ip_address: '192.168.1.100',
      status: 'success',
      details: 'Successful login'
    },
    {
      id: '2',
      timestamp: '2024-01-20 14:15:45',
      user_email: 'user@example.com',
      event_type: 'Failed Login',
      ip_address: '192.168.1.101',
      status: 'failed',
      details: 'Invalid credentials'
    },
    {
      id: '3',
      timestamp: '2024-01-20 13:45:12',
      user_email: 'staff@napol.co.ke',
      event_type: 'Password Change',
      ip_address: '192.168.1.102',
      status: 'success',
      details: 'Password changed successfully'
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      // Simulate saving security settings
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Security settings updated successfully');
    } catch (error) {
      toast.error('Failed to update security settings');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof SecuritySettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-success text-white"><CheckCircle className="h-3 w-3 mr-1" />Success</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'blocked':
        return <Badge variant="secondary"><Shield className="h-3 w-3 mr-1" />Blocked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Security Settings</h1>
          <p className="text-muted-foreground">Configure security policies and monitor system access</p>
        </div>
        <Button onClick={handleSave} disabled={loading}>
          <Shield className="h-4 w-4 mr-2" />
          {loading ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Password Policy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Password Policy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="password_min_length">Minimum Password Length</Label>
                <Input
                  id="password_min_length"
                  type="number"
                  min="6"
                  max="20"
                  value={settings.password_min_length}
                  onChange={(e) => handleInputChange('password_min_length', parseInt(e.target.value))}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="font-medium">Password Requirements</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <Label>Require Uppercase Letters</Label>
                  <Switch
                    checked={settings.require_uppercase}
                    onCheckedChange={(checked) => handleInputChange('require_uppercase', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Require Lowercase Letters</Label>
                  <Switch
                    checked={settings.require_lowercase}
                    onCheckedChange={(checked) => handleInputChange('require_lowercase', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Require Numbers</Label>
                  <Switch
                    checked={settings.require_numbers}
                    onCheckedChange={(checked) => handleInputChange('require_numbers', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Require Special Characters</Label>
                  <Switch
                    checked={settings.require_special_chars}
                    onCheckedChange={(checked) => handleInputChange('require_special_chars', checked)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Session & Access Control */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Session & Access Control
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="session_timeout">Session Timeout (minutes)</Label>
                <Input
                  id="session_timeout"
                  type="number"
                  min="5"
                  max="120"
                  value={settings.session_timeout}
                  onChange={(e) => handleInputChange('session_timeout', parseInt(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="max_login_attempts">Max Login Attempts</Label>
                <Input
                  id="max_login_attempts"
                  type="number"
                  min="3"
                  max="10"
                  value={settings.max_login_attempts}
                  onChange={(e) => handleInputChange('max_login_attempts', parseInt(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="lockout_duration">Lockout Duration (minutes)</Label>
                <Input
                  id="lockout_duration"
                  type="number"
                  min="5"
                  max="60"
                  value={settings.lockout_duration}
                  onChange={(e) => handleInputChange('lockout_duration', parseInt(e.target.value))}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">Require 2FA for all users</p>
                </div>
                <Switch
                  checked={settings.two_factor_enabled}
                  onCheckedChange={(checked) => handleInputChange('two_factor_enabled', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Audit Logging</Label>
                  <p className="text-sm text-muted-foreground">Log all security events</p>
                </div>
                <Switch
                  checked={settings.audit_logging}
                  onCheckedChange={(checked) => handleInputChange('audit_logging', checked)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Security */}
        <Card>
          <CardHeader>
            <CardTitle>API Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>API Key</Label>
              <div className="flex gap-2">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value="sk_live_••••••••••••••••••••••••••••••••"
                  readOnly
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="outline">Regenerate</Button>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Keep your API key secure and never share it publicly
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="font-medium">SSL/TLS Enabled</span>
                </div>
                <p className="text-sm text-muted-foreground">All API communications encrypted</p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="font-medium">Rate Limiting Active</span>
                </div>
                <p className="text-sm text-muted-foreground">1000 requests per hour limit</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Recent Security Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {securityEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-mono text-sm">{event.timestamp}</TableCell>
                    <TableCell>{event.user_email}</TableCell>
                    <TableCell>{event.event_type}</TableCell>
                    <TableCell className="font-mono">{event.ip_address}</TableCell>
                    <TableCell>{getStatusBadge(event.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{event.details}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Security;