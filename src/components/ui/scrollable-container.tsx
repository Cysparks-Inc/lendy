import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ScrollableContainerProps {
  children: ReactNode;
  className?: string;
}

export const ScrollableContainer = ({ children, className }: ScrollableContainerProps) => {
  return (
    <div className={cn(
      "overflow-x-auto scrollbar-thin scrollbar-track-background scrollbar-thumb-border hover:scrollbar-thumb-muted-foreground/50",
      className
    )}>
      {children}
    </div>
  );
};