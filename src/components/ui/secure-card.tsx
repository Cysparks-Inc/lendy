import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface SecureCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  className?: string;
}

export function SecureCard({ title, value, icon: Icon, subtitle, className = "" }: SecureCardProps) {
  return (
    <Card 
      className={`border-brand-green-200 hover:border-brand-green-300 transition-colors ${className}`}
      style={{
        overflow: 'hidden !important',
        maxWidth: '100% !important',
        width: '100% !important'
      }}
    >
      <CardHeader 
        className="flex flex-row items-center justify-between space-y-0 pb-2"
        style={{ overflow: 'hidden !important' }}
      >
        <CardTitle 
          className="text-sm font-medium"
          style={{ overflow: 'hidden !important', textOverflow: 'ellipsis !important' }}
        >
          {title}
        </CardTitle>
        <Icon 
          className="h-4 w-4 text-brand-green-600 flex-shrink-0" 
          style={{ flexShrink: '0 !important' }}
        />
      </CardHeader>
      <CardContent style={{ overflow: 'hidden !important' }}>
        <div 
          className="text-2xl font-bold text-brand-green-700"
          style={{ overflow: 'hidden !important', textOverflow: 'ellipsis !important' }}
        >
          {value}
        </div>
        {subtitle && (
          <p 
            className="text-xs text-muted-foreground"
            style={{ overflow: 'hidden !important', textOverflow: 'ellipsis !important' }}
          >
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
} 