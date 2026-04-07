import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { Settings, Eye, EyeOff, Copy, RefreshCw, Shield } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { supabase } from '../integrations/supabase/client';
import { useTranslation } from '../i18n';

const PasscodeManager = () => {
  const { t } = useTranslation();
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const { updatePasscode, getCurrentPasscode, user } = useAuthStore();
  const { toast } = useToast();

  useEffect(() => { checkAdminRole(); }, [user]);
  useEffect(() => { if (isOpen && isAdmin) loadCurrentPasscode(); }, [isOpen, isAdmin]);

  const checkAdminRole = async () => {
    if (!user) { setIsAdmin(false); return; }
    try {
      const { data, error } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (error) { setIsAdmin(false); return; }
      setIsAdmin(data?.role === 'admin');
    } catch { setIsAdmin(false); }
  };

  const loadCurrentPasscode = async () => {
    setIsLoading(true);
    try {
      const passcode = await getCurrentPasscode();
      if (passcode) setCurrentPasscode(passcode);
    } catch {
      toast({ title: t('common.error'), description: t('passcode.loadFailed'), variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  const handleUpdatePasscode = async () => {
    if (!newPasscode.trim()) { toast({ title: t('common.error'), description: t('passcode.enterNew'), variant: "destructive" }); return; }
    if (newPasscode.length < 6) { toast({ title: t('common.error'), description: t('passcode.minLength'), variant: "destructive" }); return; }

    setIsLoading(true);
    try {
      const result = await updatePasscode(newPasscode);
      if (result.success) {
        setCurrentPasscode(newPasscode);
        setNewPasscode('');
        setShowConfirmDialog(false);
        toast({ title: t('passcode.updatePasscode'), description: t('passcode.updated'), duration: 5000 });
      } else {
        toast({ title: t('common.error'), description: result.error || t('passcode.updateFailed'), variant: "destructive" });
      }
    } catch {
      toast({ title: t('common.error'), description: t('passcode.updateError'), variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  const copyToClipboardFn = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: t('passcode.updatePasscode'), description: t('passcode.copied') });
    } catch {
      toast({ title: t('common.error'), description: t('passcode.copyFailed'), variant: "destructive" });
    }
  };

  const generateRandomPasscode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    setNewPasscode(result);
  };

  if (!isAdmin) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Shield className="h-4 w-4 mr-2" />
            {t('passcode.managePasscode')}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-orange-500" />
              <span>{t('passcode.title')}</span>
            </DialogTitle>
            <DialogDescription>
              <span className="text-orange-600 font-medium">{t('passcode.adminOnly')}:</span> {t('passcode.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Card className="border-orange-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center space-x-2">
                  <span>{t('passcode.currentPasscode')}</span>
                  <Shield className="h-3 w-3 text-orange-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 relative">
                    <Input type={showPasscode ? "text" : "password"} value={currentPasscode} readOnly className="pr-20 bg-orange-50" />
                    <div className="absolute right-1 top-1 flex space-x-1">
                      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setShowPasscode(!showPasscode)}>
                        {showPasscode ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => copyToClipboardFn(currentPasscode)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-red-600">{t('passcode.updatePasscode')}</CardTitle>
                <CardDescription className="text-xs text-red-500">{t('passcode.updateWarning')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="new-passcode">{t('passcode.newPasscode')}</Label>
                    <div className="flex space-x-2">
                      <Input id="new-passcode" type="text" placeholder={t('passcode.newPasscodePlaceholder')} value={newPasscode} onChange={(e) => setNewPasscode(e.target.value)} className="flex-1" minLength={6} />
                      <Button type="button" variant="outline" size="sm" onClick={generateRandomPasscode}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('passcode.sharePasscode')}</p>
                  </div>
                  <Button type="button" className="w-full bg-red-600 hover:bg-red-700" disabled={isLoading || newPasscode.length < 6} onClick={() => setShowConfirmDialog(true)}>
                    {t('passcode.updateSecurityAction')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-red-500" />
              <span>{t('passcode.confirmTitle')}</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('passcode.confirmDesc')}
              <br /><br />
              <strong>{t('passcode.newPasscodeLabel')}:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{newPasscode}</code>
              <br /><br />
              {t('passcode.confirmProceed')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleUpdatePasscode} className="bg-red-600 hover:bg-red-700" disabled={isLoading}>
              {isLoading ? t('passcode.updating') : t('passcode.confirmUpdate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PasscodeManager;
