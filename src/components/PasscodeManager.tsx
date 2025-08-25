
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

const PasscodeManager = () => {
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const { updatePasscode, getCurrentPasscode, user } = useAuthStore();
  const { toast } = useToast();

  useEffect(() => {
    checkAdminRole();
  }, [user]);

  useEffect(() => {
    if (isOpen && isAdmin) {
      loadCurrentPasscode();
    }
  }, [isOpen, isAdmin]);

  const checkAdminRole = async () => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error checking admin role:', error);
        setIsAdmin(false);
        return;
      }

      setIsAdmin(data?.role === 'admin');
    } catch (error) {
      console.error('Error checking admin role:', error);
      setIsAdmin(false);
    }
  };

  const loadCurrentPasscode = async () => {
    setIsLoading(true);
    try {
      const passcode = await getCurrentPasscode();
      if (passcode) {
        setCurrentPasscode(passcode);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load current passcode. Admin access required.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePasscode = async () => {
    if (!newPasscode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a new passcode",
        variant: "destructive"
      });
      return;
    }

    if (newPasscode.length < 6) {
      toast({
        title: "Error",
        description: "Passcode must be at least 6 characters long for security",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await updatePasscode(newPasscode);
      if (result.success) {
        setCurrentPasscode(newPasscode);
        setNewPasscode('');
        setShowConfirmDialog(false);
        toast({
          title: "Passcode updated",
          description: "The system passcode has been successfully updated. This is a security-sensitive operation.",
          duration: 5000
        });
        
        // Log security event
        console.log(`Security Event: System passcode updated by admin user ${user?.email} at ${new Date().toISOString()}`);
      } else {
        toast({
          title: "Update failed",
          description: result.error || "Failed to update passcode. Admin access required.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while updating the passcode. Please verify admin permissions.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: "Passcode copied to clipboard (security sensitive)"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy passcode",
        variant: "destructive"
      });
    }
  };

  const generateRandomPasscode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPasscode(result);
  };

  const handleConfirmUpdate = () => {
    setShowConfirmDialog(true);
  };

  // Only render for admin users
  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Shield className="h-4 w-4 mr-2" />
            Manage Passcode
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-orange-500" />
              <span>System Passcode Management</span>
            </DialogTitle>
            <DialogDescription>
              <span className="text-orange-600 font-medium">Admin Only:</span> Control access to the system by managing the signup passcode. This is a security-sensitive operation.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Card className="border-orange-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center space-x-2">
                  <span>Current Passcode</span>
                  <Shield className="h-3 w-3 text-orange-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 relative">
                    <Input
                      type={showPasscode ? "text" : "password"}
                      value={currentPasscode}
                      readOnly
                      className="pr-20 bg-orange-50"
                    />
                    <div className="absolute right-1 top-1 flex space-x-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setShowPasscode(!showPasscode)}
                      >
                        {showPasscode ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => copyToClipboard(currentPasscode)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-red-600">Update Passcode</CardTitle>
                <CardDescription className="text-xs text-red-500">
                  Changing this will affect all future user registrations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="new-passcode">New Passcode</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="new-passcode"
                        type="text"
                        placeholder="Enter new passcode (min 6 chars)"
                        value={newPasscode}
                        onChange={(e) => setNewPasscode(e.target.value)}
                        className="flex-1"
                        minLength={6}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={generateRandomPasscode}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Share this passcode with authorized users for account creation. Minimum 6 characters required.
                    </p>
                  </div>
                  <Button 
                    type="button" 
                    className="w-full bg-red-600 hover:bg-red-700" 
                    disabled={isLoading || newPasscode.length < 6}
                    onClick={handleConfirmUpdate}
                  >
                    Update Passcode (Security Action)
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
              <span>Confirm Security Action</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to update the system passcode. This will change the access code required for new user registrations. 
              <br /><br />
              <strong>New passcode:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{newPasscode}</code>
              <br /><br />
              Are you sure you want to proceed with this security-sensitive change?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleUpdatePasscode}
              className="bg-red-600 hover:bg-red-700"
              disabled={isLoading}
            >
              {isLoading ? "Updating..." : "Confirm Update"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PasscodeManager;
