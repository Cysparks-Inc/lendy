import React from 'react';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error';
  text?: string;
  className?: string;
}

// Simple, instant-feeling spinner
const Loader: React.FC<LoaderProps> = ({ 
  size = 'md', 
  variant = 'default', 
  text,
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  const variantClasses = {
    default: 'text-brand-green-600',
    primary: 'text-brand-green-600',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    error: 'text-red-600'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {/* Simple, fast spinner */}
      <div className={`${sizeClasses[size]} border-2 border-gray-200 border-t-brand-green-600 rounded-full animate-spin-fast`}></div>
      
      {/* Loading text */}
      {text && (
        <div className="mt-2 text-center animate-fade-in-up">
          <p className="text-sm font-medium text-gray-600">
            {text}
          </p>
        </div>
      )}
    </div>
  );
};

// Page Loader Component - Branded with Lendy logo
export const PageLoader: React.FC<{ text?: string }> = ({ text = 'Loading...' }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-blue-50 to-white flex items-center justify-center">
      <div className="text-center animate-scale-in">
        {/* Lendy Logo */}
        <div className="mb-6">
          <div className="w-24 h-24 mx-auto mb-4">
            <img 
              src="/lovable-uploads/logo-napol.png" 
              alt="Lendy Microfinance" 
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-brand-blue-800">Lendy Microfinance</h1>
          <p className="text-gray-600 mt-1 text-sm">Loading your dashboard...</p>
        </div>
        
        {/* Simple, fast loader */}
        <div className="w-16 h-16 border-4 border-gray-200 border-t-brand-blue-600 rounded-full animate-spin-fast mx-auto"></div>
        
        {/* Loading text */}
        {text && (
          <p className="text-brand-blue-700 font-medium mt-4 animate-fade-in-up">{text}</p>
        )}
      </div>
    </div>
  );
};

// Inline Loader Component - Simple and fast
export const InlineLoader: React.FC<{ size?: 'sm' | 'md' | 'lg'; variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' }> = ({ 
  size = 'sm', 
  variant = 'default' 
}) => {
  return <Loader size={size} variant={variant} />;
};

// Button Loader Component - Minimal and fast
export const ButtonLoader: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'sm' }) => {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <div className={`${sizeClasses[size]} border-2 border-white border-t-transparent rounded-full animate-spin-fast`}></div>
  );
};

// Quick Loader - For instant feedback
export const QuickLoader: React.FC<{ text?: string }> = ({ text }) => {
  return (
    <div className="flex items-center justify-center space-x-2 animate-fade-in-up">
      <div className="w-4 h-4 border-2 border-brand-green-200 border-t-brand-green-600 rounded-full animate-spin-fast"></div>
      {text && <span className="text-sm text-gray-600">{text}</span>}
    </div>
  );
};

// Skeleton Loader - For content placeholders
export const SkeletonLoader: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`animate-pulse-soft bg-gray-200 rounded ${className}`}></div>
  );
};

// Card Skeleton Loader - For card placeholders
export const CardSkeleton: React.FC = () => {
  return (
    <div className="border rounded-lg p-4 space-y-3 animate-fade-in-up">
      <div className="flex items-center space-x-3">
        <SkeletonLoader className="w-12 h-12 rounded-full" />
        <div className="space-y-2 flex-1">
          <SkeletonLoader className="h-4 w-3/4" />
          <SkeletonLoader className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonLoader className="h-3 w-full" />
      <SkeletonLoader className="h-3 w-2/3" />
    </div>
  );
};

// Progress Loader - For operations with known progress
export const ProgressLoader: React.FC<{ 
  progress: number; 
  text?: string; 
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
}> = ({ progress, text, showPercentage = true, size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  return (
    <div className="w-full space-y-2 animate-fade-in-up">
      {text && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">{text}</span>
          {showPercentage && (
            <span className="text-brand-green-600 font-medium">{Math.round(progress)}%</span>
          )}
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full ${sizeClasses[size]}`}>
        <div 
          className={`bg-brand-green-600 ${sizeClasses[size]} rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
};

// Dots Loader - For simple loading states
export const DotsLoader: React.FC<{ text?: string; color?: string }> = ({ text, color = 'brand-green-600' }) => {
  return (
    <div className="flex items-center justify-center space-x-1 animate-fade-in-up">
      <div className={`w-2 h-2 bg-${color} rounded-full animate-pulse-soft`} style={{ animationDelay: '0ms' }}></div>
      <div className={`w-2 h-2 bg-${color} rounded-full animate-pulse-soft`} style={{ animationDelay: '150ms' }}></div>
      <div className={`w-2 h-2 bg-${color} rounded-full animate-pulse-soft`} style={{ animationDelay: '300ms' }}></div>
      {text && <span className="text-sm text-gray-600 ml-2">{text}</span>}
    </div>
  );
};

// Instant Loader - For very quick operations
export const InstantLoader: React.FC<{ text?: string }> = ({ text }) => {
  return (
    <div className="flex items-center justify-center space-x-2 animate-scale-in">
      <div className="w-3 h-3 bg-brand-green-600 rounded-full animate-pulse-soft"></div>
      {text && <span className="text-xs text-gray-500">{text}</span>}
    </div>
  );
};

// Table Skeleton Loader - For table placeholders
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({ rows = 5, columns = 4 }) => {
  return (
    <div className="space-y-3 animate-fade-in-up">
      {/* Header */}
      <div className="flex space-x-4 pb-2 border-b">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonLoader key={i} className="h-4 w-20" />
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex space-x-4 py-2">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <SkeletonLoader key={colIndex} className="h-4 w-24" />
          ))}
        </div>
      ))}
    </div>
  );
};

export default Loader;