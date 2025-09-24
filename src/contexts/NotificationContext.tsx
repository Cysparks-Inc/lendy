import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  loan_id?: string;
  member_name?: string;
  amount?: number;
  created_at: string;
  read: boolean;
  is_read: boolean;
  user_id: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'created_at' | 'read' | 'is_read' | 'user_id'>) => void;
  clearAll: () => void;
  isLoading: boolean;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Mock notifications functionality for now
  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true, is_read: true } : n)
    );
  };

  const markAllAsRead = async () => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true, is_read: true }))
    );
  };

  const addNotification = (notification: Omit<Notification, 'id' | 'created_at' | 'read' | 'is_read' | 'user_id'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
      read: false,
      is_read: false,
      user_id: user?.id || '',
    };
    setNotifications(prev => [newNotification, ...prev]);
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        addNotification,
        clearAll,
        isLoading,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};