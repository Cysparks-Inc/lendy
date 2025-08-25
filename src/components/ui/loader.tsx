import React from 'react';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error';
  text?: string;
  className?: string;
}

const Loader: React.FC<LoaderProps> = ({ 
  size = 'md', 
  variant = 'default', 
  text,
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const variantClasses = {
    default: 'text-gray-600',
    primary: 'text-blue-600',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    error: 'text-red-600'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {/* Modern Spinner */}
      <div className={`relative ${sizeClasses[size]}`}>
        {/* Outer ring */}
        <div className={`absolute inset-0 rounded-full border-2 border-gray-200`}></div>
        
        {/* Animated ring */}
        <div className={`absolute inset-0 rounded-full border-2 border-t-transparent ${variantClasses[variant]} animate-spin`}></div>
        
        {/* Inner dot */}
        <div className={`absolute inset-2 rounded-full ${variantClasses[variant]} animate-pulse`}></div>
      </div>
      
      {/* Loading text */}
      {text && (
        <div className="mt-3 text-center">
          <p className={`text-sm font-medium ${variantClasses[variant]}`}>
            {text}
          </p>
          {/* Animated dots */}
          <div className="flex justify-center mt-1 space-x-1">
            <div className={`w-1 h-1 rounded-full ${variantClasses[variant]} animate-bounce`} style={{ animationDelay: '0ms' }}></div>
            <div className={`w-1 h-1 rounded-full ${variantClasses[variant]} animate-bounce`} style={{ animationDelay: '150ms' }}></div>
            <div className={`w-1 h-1 rounded-full ${variantClasses[variant]} animate-bounce`} style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      )}
    </div>
  );
};

// Page Loader Component
export const PageLoader: React.FC<{ text?: string }> = ({ text = 'Loading...' }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
      <div className="text-center">
        {/* Logo/Brand */}
        <div className="mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white text-2xl font-bold">N</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Napol Microfinance</h1>
          <p className="text-gray-600 mt-1">Loading your dashboard...</p>
        </div>
        
        {/* Loader */}
        <Loader size="xl" variant="primary" text={text} />
        
        {/* Progress bar */}
        <div className="w-64 bg-gray-200 rounded-full h-2 mt-6 mx-auto overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
        </div>
      </div>
    </div>
  );
};

// Inline Loader Component
export const InlineLoader: React.FC<{ size?: 'sm' | 'md' | 'lg'; variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' }> = ({ 
  size = 'sm', 
  variant = 'default' 
}) => {
  return <Loader size={size} variant={variant} />;
};

// Button Loader Component
export const ButtonLoader: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'sm' }) => {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <div className={`${sizeClasses[size]} border-2 border-white border-t-transparent rounded-full animate-spin`}></div>
  );
};

export default Loader;