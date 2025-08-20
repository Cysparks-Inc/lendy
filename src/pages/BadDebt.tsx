import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Loader } from '@/components/ui/loader';

const BadDebt = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => setLoading(false), 1000);
  }, []);

  if (loading) return <Loader size="lg" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Bad Debt Accounts</h1>
        <p className="text-muted-foreground">Manage irrecoverable loan accounts</p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Bad Debt Management</CardTitle>
          <CardDescription>Accounts written off as bad debt</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No bad debt accounts found.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BadDebt;