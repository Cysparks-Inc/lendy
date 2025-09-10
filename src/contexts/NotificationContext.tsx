import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

interface Notification {
  id: string;
  type: 'loan_approved' | 'loan_rejected' | 'loan_pending' | 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  loan_id?: string;
  member_name?: string;
  amount?: number;
  created_at: string;
  read: boolean;
  is_read?: boolean;
  user_id: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  refreshNotifications: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'created_at' | 'read' | 'user_id'>) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      // Fetch notifications from the database
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (notificationsError) throw notificationsError;

      // Transform the data to match our interface
      const notificationData: Notification[] = (notificationsData || []).map(notification => ({
        id: notification.id,
        type: notification.type || 'info',
        title: notification.title,
        message: notification.message,
        loan_id: notification.related_entity_id,
        member_name: notification.member_name,
        amount: notification.amount || 0,
        created_at: notification.created_at,
        read: notification.is_read || false,
        is_read: notification.is_read || false,
        user_id: notification.user_id
      }));

      setNotifications(notificationData);
      setUnreadCount(notificationData.filter(n => !n.read).length);

    } catch (error: any) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      // Update in database
      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === id 
            ? { ...notification, read: true, is_read: true }
            : notification
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications
        .filter(n => !n.read)
        .map(n => n.id);

      if (unreadIds.length === 0) return;

      // Update in database
      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .in('id', unreadIds);

      if (error) throw error;

      // Update local state
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, read: true, is_read: true }))
      );
      setUnreadCount(0);
    } catch (error: any) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const refreshNotifications = () => {
    fetchNotifications();
  };

  const addNotification = async (notificationData: Omit<Notification, 'id' | 'created_at' | 'read' | 'user_id'>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          type: notificationData.type,
          title: notificationData.title,
          message: notificationData.message,
          related_entity_type: notificationData.loan_id ? 'loan' : undefined,
          related_entity_id: notificationData.loan_id,
          member_name: notificationData.member_name,
          amount: notificationData.amount,
          is_read: false
        });

      if (error) throw error;

      // Refresh notifications to get the new one
      fetchNotifications();
    } catch (error: any) {
      console.error('Error adding notification:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // Set up real-time subscription for notifications
      const subscription = supabase
        .channel('notifications_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('New notification received:', payload);
            // Refresh notifications when new notification is added
            fetchNotifications();
            
            // Show toast notification
            const notification = payload.new;
            if (notification.type === 'loan_approved') {
              toast.success(notification.title, {
                description: notification.message
              });
            } else if (notification.type === 'loan_rejected') {
              toast.error(notification.title, {
                description: notification.message
              });
            } else {
              toast.info(notification.title, {
                description: notification.message
              });
            }
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  const value = {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
    addNotification
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
