import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../integrations/supabase/client';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import VoiceQCLogo from '../components/VoiceQCLogo';
import { useTranslation } from '../i18n';

const Auth = () => {
  const { t } = useTranslation();
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({ email: '', password: '', name: '', passcode: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login, signUp, isAuthenticated, setAuth } = useAuthStore();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setAuth(session);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuth(session);
    });
    return () => subscription.unsubscribe();
  }, [setAuth]);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await login(loginData.email, loginData.password);
      if (result.success) {
        toast({ title: t('auth.loginSuccess'), description: t('auth.welcomeQC') });
      } else {
        toast({ title: t('auth.loginFailed'), description: result.error || t('auth.invalidCredentials'), variant: "destructive" });
      }
    } catch (error) {
      toast({ title: t('auth.error'), description: t('auth.loginError'), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await signUp(signupData.email, signupData.password, signupData.name, signupData.passcode);
      if (result.success) {
        if (result.emailConfirmationRequired) {
          toast({ title: t('auth.emailConfirmRequired'), description: t('auth.checkEmail') });
        } else {
          toast({ title: t('auth.accountCreated'), description: t('auth.welcomeQC') });
        }
      } else {
        toast({ title: t('auth.signUpFailed'), description: result.error || t('auth.signUpFailed'), variant: "destructive" });
      }
    } catch (error) {
      toast({ title: t('auth.error'), description: t('auth.signUpError'), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <VoiceQCLogo size="lg" />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">{t('auth.login')}</TabsTrigger>
              <TabsTrigger value="signup">{t('auth.signUp')}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">{t('auth.email')}</Label>
                  <Input id="login-email" type="email" placeholder="supervisor@company.com" value={loginData.email} onChange={e => setLoginData(prev => ({ ...prev, email: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">{t('auth.password')}</Label>
                  <div className="relative">
                    <Input id="login-password" type={showPassword ? "text" : "password"} value={loginData.password} onChange={e => setLoginData(prev => ({ ...prev, password: e.target.value }))} required />
                    <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('auth.signingIn')}</>) : t('auth.signIn')}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">{t('auth.fullName')}</Label>
                  <Input id="signup-name" type="text" value={signupData.name} onChange={e => setSignupData(prev => ({ ...prev, name: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">{t('auth.email')}</Label>
                  <Input id="signup-email" type="email" value={signupData.email} onChange={e => setSignupData(prev => ({ ...prev, email: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">{t('auth.password')}</Label>
                  <div className="relative">
                    <Input id="signup-password" type={showSignupPassword ? "text" : "password"} value={signupData.password} onChange={e => setSignupData(prev => ({ ...prev, password: e.target.value }))} required />
                    <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowSignupPassword(!showSignupPassword)}>
                      {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-passcode">{t('auth.accessPasscode')}</Label>
                  <Input id="signup-passcode" type="password" value={signupData.passcode} onChange={e => setSignupData(prev => ({ ...prev, passcode: e.target.value }))} required />
                  <p className="text-xs text-muted-foreground">{t('auth.contactAdmin')}</p>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('auth.creatingAccount')}</>) : t('auth.createAccount')}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
