import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import VoiceQCLogo from '../components/VoiceQCLogo';

const EmailConfirmed = () => {
  const { isAuthenticated, setAuth } = useAuthStore();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        // Get the current session after email confirmation
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          toast({
            title: "Confirmation processed",
            description: "Please log in to continue.",
            variant: "default"
          });
          setTimeout(() => navigate('/auth'), 2000);
        } else if (session) {
          // User is now authenticated
          setAuth(session);
          toast({
            title: "Email confirmed successfully",
            description: "Welcome! You can now access the system."
          });
          setTimeout(() => navigate('/'), 1500);
        } else {
          // No session, but email was confirmed - show success and redirect to login
          toast({
            title: "Email confirmed successfully",
            description: "Please log in to continue."
          });
          setTimeout(() => navigate('/auth'), 2000);
        }
      } catch (error) {
        console.error('Error handling email confirmation:', error);
        toast({
          title: "Confirmation processed",
          description: "Please log in to continue.",
          variant: "default"
        });
        setTimeout(() => navigate('/auth'), 2000);
      } finally {
        setIsProcessing(false);
      }
    };

    handleEmailConfirmation();
  }, [setAuth, toast, navigate]);

  // If user is already authenticated, redirect to dashboard
  if (isAuthenticated && !isProcessing) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <VoiceQCLogo size="lg" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2 text-green-600">
            <CheckCircle className="h-6 w-6" />
            Email Confirmed
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Your email has been successfully confirmed. Your account is now active.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Redirecting to login...
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailConfirmed;