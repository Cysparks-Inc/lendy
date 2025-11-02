import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Loader2,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  is_read: boolean;
  related_entity_type?: string;
  related_entity_id?: string;
  created_at: string;
  read_at?: string;
  member_name?: string;
  approver_name?: string;
}


const Notifications: React.FC = () => {
  const { user, userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (userRole) {
      fetchData();
    }
  }, [userRole]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch notifications
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (notificationsError) throw notificationsError;

      // For loan-related notifications, fetch loan details with member and approver info
      const loanNotifications = (notificationsData || []).filter(n => n.related_entity_type === 'loan' && n.related_entity_id);
      
      if (loanNotifications.length > 0) {
        const loanIds = loanNotifications.map(n => n.related_entity_id).filter(Boolean) as string[];
        
        // Fetch loans with member and approver info
        const { data: loansData, error: loansError } = await supabase
          .from('loans')
          .select('id, member_id, approved_by')
          .in('id', loanIds);

        if (!loansError && loansData) {
          // Get unique member IDs and approver IDs
          const memberIds = [...new Set(loansData.map(l => l.member_id).filter(Boolean))];
          const approverIds = [...new Set(loansData.map(l => l.approved_by).filter(Boolean))];
          
          // Fetch members
          const [membersRes, approversRes] = await Promise.all([
            memberIds.length > 0 
              ? supabase.from('members').select('id, first_name, last_name').in('id', memberIds)
              : { data: [], error: null },
            approverIds.length > 0
              ? supabase.from('profiles').select('id, full_name').in('id', approverIds)
              : { data: [], error: null }
          ]);
          
          // Create lookup maps
          const membersMap = new Map(
            (membersRes.data || []).map(m => [
              m.id,
              `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Unknown Member'
            ])
          );
          const approversMap = new Map(
            (approversRes.data || []).map(a => [a.id, a.full_name || 'Unknown Approver'])
          );
          
          // Create loan details map
          const loanDetailsMap = new Map(
            loansData.map(loan => [
              loan.id,
              {
                member_name: loan.member_id ? (membersMap.get(loan.member_id) || 'Unknown Member') : 'Unknown Member',
                approver_name: loan.approved_by ? (approversMap.get(loan.approved_by) || 'System') : 'System'
              }
            ])
          );
          
          // Enrich notifications with member and approver names
          const enrichedNotifications = (notificationsData || []).map(notification => {
            if (notification.related_entity_type === 'loan' && notification.related_entity_id) {
              const details = loanDetailsMap.get(notification.related_entity_id);
              return {
                ...notification,
                member_name: details?.member_name,
                approver_name: details?.approver_name
              };
            }
            return notification;
          });
          
          setNotifications(enrichedNotifications);
          setUnreadCount(enrichedNotifications.filter(n => !n.is_read).length || 0);
        } else {
          setNotifications(notificationsData || []);
          setUnreadCount(notificationsData?.filter(n => !n.is_read).length || 0);
        }
      } else {
        setNotifications(notificationsData || []);
        setUnreadCount(notificationsData?.filter(n => !n.is_read).length || 0);
      }

    } catch (error: any) {
      toast.error('Failed to fetch data', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
      );

      setUnreadCount(prev => Math.max(0, prev - 1));
      toast.success('Notification marked as read');

    } catch (error: any) {
      toast.error('Failed to mark notification as read', { description: error.message });
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications
        .filter(n => !n.is_read)
        .map(n => n.id);

      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .in('id', unreadIds);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => 
          !n.is_read 
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
      );

      setUnreadCount(0);
      toast.success('All notifications marked as read');

    } catch (error: any) {
      toast.error('Failed to mark all notifications as read', { description: error.message });
    }
  };

  const clearAllNotifications = async () => {
    try {
      if (!confirm('Are you sure you want to delete all notifications? This action cannot be undone.')) {
        return;
      }

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user?.id);

      if (error) throw error;

      setNotifications([]);
      setUnreadCount(0);
      toast.success('All notifications cleared');

    } catch (error: any) {
      toast.error('Failed to clear notifications', { description: error.message });
    }
  };


  const getNotificationIcon = (type: string) => {
    const iconConfig = {
      info: { icon: Bell, color: 'text-blue-500' },
      warning: { icon: AlertCircle, color: 'text-yellow-500' },
      error: { icon: XCircle, color: 'text-red-500' },
      success: { icon: CheckCircle, color: 'text-green-500' }
    };

    const config = iconConfig[type as keyof typeof iconConfig] || iconConfig.info;
    const Icon = config.icon;

    return <Icon className={`w-5 h-5 ${config.color}`} />;
  };

  const getNotificationBadge = (type: string) => {
    const badgeConfig = {
      info: 'bg-blue-100 text-blue-800',
      warning: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
      success: 'bg-green-100 text-green-800'
    };

    return badgeConfig[type as keyof typeof badgeConfig] || badgeConfig.info;
  };

  // Allow all authenticated roles to see their own notifications

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            Manage system notifications and pending loan approvals
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button onClick={markAllAsRead} variant="outline">
              <Eye className="w-4 h-4 mr-2" />
              Mark All as Read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button onClick={clearAllNotifications} variant="destructive">
              Clear All
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Notifications</CardTitle>
              <CardDescription>
                {notifications.length === 0 
                  ? 'No notifications available'
                  : `${notifications.length} total notifications, ${unreadCount} unread`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No notifications to display</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notifications.map((notification) => (
                    <Card 
                      key={notification.id} 
                      className={`transition-colors ${
                        !notification.is_read 
                          ? 'bg-blue-50 border-blue-200' 
                          : 'bg-white'
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            {getNotificationIcon(notification.type)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <h3 className="font-medium text-sm">
                                  {notification.title}
                                </h3>
                                <Badge className={getNotificationBadge(notification.type)}>
                                  {notification.type}
                                </Badge>
                                {!notification.is_read && (
                                  <Badge variant="outline" className="bg-blue-100 text-blue-800">
                                    New
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {notification.related_entity_type === 'loan' && notification.member_name
                                  ? (
                                    <>
                                      Loan application for <strong>{notification.member_name}</strong> was {notification.type === 'success' ? 'approved' : notification.type === 'error' ? 'rejected' : 'updated'}.
                                      <span className="block mt-1 text-xs">
                                        Approved by: <strong>{notification.approver_name || 'System'}</strong>
                                      </span>
                                    </>
                                  )
                                  : notification.message
                                }
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(notification.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          {!notification.is_read && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => markAsRead(notification.id)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
      </div>
    </div>
  );
};

export default Notifications;
