import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PageLoader, ButtonLoader } from '@/components/ui/loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Lock, Mail, Shield } from 'lucide-react';

const Auth = () => {
  const { user, signIn, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already authenticated
  if (user && !loading) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await signIn(email, password);
    setIsSubmitting(false);
  };

  if (loading) {
    return <PageLoader text="Loading your dashboard..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-blue-50 via-white to-brand-blue-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-blue-200 rounded-full opacity-20 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-blue-300 rounded-full opacity-20 blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-blue-100 rounded-full opacity-10 blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo and Branding */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-brand-blue-200 rounded-full blur-xl opacity-30"></div>
              <img 
                src="/lovable-uploads/logo-napol.png" 
                alt="Lendy Logo" 
                className="h-32 w-32 object-contain relative z-10 drop-shadow-lg rounded-full bg-white p-2"
              />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-center mb-3 bg-gradient-to-r from-brand-blue-600 to-brand-blue-700 bg-clip-text text-transparent">
            Welcome Back
          </h1>
          <p className="text-muted-foreground text-center text-lg">
            Sign in to access your Lendy dashboard
          </p>
        </div>

        {/* Login Form Card */}
        <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-2xl">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-semibold text-foreground">
              <div className="flex items-center justify-center gap-2">
                <Shield className="h-5 w-5 text-brand-blue-600" />
                Secure Login
              </div>
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter your credentials to continue
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-brand-blue-600" />
                    Email Address
                  </div>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="h-12 border-2 border-gray-200 focus:border-brand-blue-500 focus:ring-brand-blue-500/20 transition-all duration-200"
                  required
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-brand-blue-600" />
                    Password
                  </div>
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="h-12 border-2 border-gray-200 focus:border-brand-blue-500 focus:ring-brand-blue-500/20 transition-all duration-200 pr-12"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-gradient-to-r from-brand-blue-600 to-brand-blue-700 hover:from-brand-blue-700 hover:to-brand-blue-800 text-white font-semibold text-lg rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:transform-none shadow-lg hover:shadow-xl"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <ButtonLoader size="sm" />
                    <span>Signing In...</span>
                  </div>
                ) : (
                  <span>Sign In</span>
                )}
              </Button>
            </form>

            {/* Additional Info */}
            <div className="text-center pt-4 border-t border-gray-100">
              <p className="text-muted-foreground text-sm">
                Contact administrator for account access
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-muted-foreground">
            © 2025 Lendy Microfinance. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;