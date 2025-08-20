import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Clock } from 'lucide-react';
import { Loader } from '@/components/ui/loader';

const DormantMembers = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => setLoading(false), 1000);
  }, []);

  if (loading) return <Loader size="lg" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dormant Members List</h1>
        <p className="text-muted-foreground">Members with no recent activity</p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Dormant Member Analysis</CardTitle>
          <CardDescription>Members inactive for over 90 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No dormant members found.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DormantMembers;