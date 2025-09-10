import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bell, 
  CheckCircle, 
  XCircle, 
  Clock, 
  DollarSign,
  Check,
  CheckCheck,
  FileText,
  Users
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const Notifications: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingLoansCount, setPendingLoansCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchPendingLoansCount();
  }, [userRole]);

  const fetchPendingLoansCount = async () => {
    try {
      // Fetch pending loans count for all users who can see loan approvals
      if (userRole === 'super_admin' || userRole === 'admin' || userRole === 'loan_officer') {
        const { count, error } = await supabase
          .from('loans')
          .select('*', { count: 'exact', head: true })
          .eq('approval_status', 'pending');

        if (error) {
          console.error('Error fetching pending loans count:', error);
        } else {
          setPendingLoansCount(count || 0);
        }
      }
    } catch (error) {
      console.error('Error fetching pending loans count:', error);
    }
  };

  useEffect(() => {
    setTotalCount(unreadCount + pendingLoansCount);
  }, [unreadCount, pendingLoansCount]);

  // Refresh pending loans count when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchPendingLoansCount();
    }
  }, [isOpen]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'loan_approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'loan_rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'loan_pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'loan_approved':
        return 'border-l-green-500 bg-green-50';
      case 'loan_rejected':
        return 'border-l-red-500 bg-red-50';
      case 'loan_pending':
        return 'border-l-yellow-500 bg-yellow-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  const handleNotificationClick = () => {
    setIsOpen(false);
    navigate('/notifications');
  };

  const handlePendingLoansClick = () => {
    setIsOpen(false);
    navigate('/loans/approvals');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {totalCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {totalCount > 99 ? '99+' : totalCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Notifications</span>
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs"
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNotificationClick}
                className="text-xs"
              >
                <FileText className="h-3 w-3 mr-1" />
                View All
              </Button>
            </div>
          </DialogTitle>
          <DialogDescription>
            {totalCount > 0 
              ? `${unreadCount} unread notifications${pendingLoansCount > 0 ? `, ${pendingLoansCount} pending loans` : ''}`
              : 'No notifications'
            }
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-96">
          <div className="space-y-4">
            {/* Pending Loans Section */}
            {pendingLoansCount > 0 && (userRole === 'super_admin' || userRole === 'admin') && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-900 flex items-center">
                    <Users className="h-4 w-4 mr-2 text-orange-500" />
                    Pending Loan Approvals
                  </h3>
                  <Badge variant="outline" className="bg-orange-100 text-orange-800">
                    {pendingLoansCount}
                  </Badge>
                </div>
                <Card 
                  className="cursor-pointer transition-colors hover:bg-orange-50 border-orange-200"
                  onClick={handlePendingLoansClick}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center space-x-3">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {pendingLoansCount} loan{pendingLoansCount === 1 ? '' : 's'} awaiting approval
                        </p>
                        <p className="text-xs text-gray-500">
                          Click to review and approve
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Notifications Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-900 flex items-center">
                  <Bell className="h-4 w-4 mr-2 text-blue-500" />
                  System Notifications
                </h3>
                {unreadCount > 0 && (
                  <Badge variant="outline" className="bg-blue-100 text-blue-800">
                    {unreadCount}
                  </Badge>
                )}
              </div>
              
              {notifications.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.slice(0, 5).map((notification) => (
                    <Card 
                      key={notification.id}
                      className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                        notification.read ? 'opacity-60' : ''
                      }`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-1">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium text-gray-900">
                                {notification.title}
                              </h4>
                              {!notification.read && (
                                <div className="h-2 w-2 bg-blue-600 rounded-full flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {notification.message}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center space-x-2 text-xs text-gray-500">
                                <DollarSign className="h-3 w-3" />
                                <span>KES {notification.amount.toLocaleString()}</span>
                              </div>
                              <span className="text-xs text-gray-400">
                                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {notifications.length > 5 && (
                    <Card 
                      className="cursor-pointer transition-colors hover:bg-gray-50 border-dashed"
                      onClick={handleNotificationClick}
                    >
                      <CardContent className="p-3 text-center">
                        <p className="text-sm text-gray-500">
                          View {notifications.length - 5} more notifications
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default Notifications;
