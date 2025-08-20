import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';

const Security = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Security Settings</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Security Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Security settings coming soon.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Security;