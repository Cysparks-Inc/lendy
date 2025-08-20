import { cn } from "@/lib/utils";

interface LoaderProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Loader({ className, size = "md" }: LoaderProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8", 
    lg: "h-12 w-12"
  };

  return (
    <div className="flex items-center justify-center p-4">
      <div className={cn(
        "animate-spin rounded-full border-2 border-muted border-t-primary",
        sizeClasses[size],
        className
      )} />
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="relative">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-muted border-t-primary mx-auto" />
          <div className="absolute inset-0 h-16 w-16 animate-ping rounded-full border border-primary/20 mx-auto" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Loading Napol</h2>
          <p className="text-sm text-muted-foreground">Please wait while we prepare your data...</p>
        </div>
      </div>
    </div>
  );
}