
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Settings, Eye, EyeOff, Copy, RefreshCw } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const PasscodeManager = () => {
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const { updatePasscode, getCurrentPasscode } = useAuthStore();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadCurrentPasscode();
    }
  }, [isOpen]);

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
        description: "Failed to load current passcode",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPasscode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a new passcode",
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
        toast({
          title: "Passcode updated",
          description: "The system passcode has been successfully updated"
        });
      } else {
        toast({
          title: "Update failed",
          description: result.error || "Failed to update passcode",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while updating the passcode",
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
        description: "Passcode copied to clipboard"
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Manage Passcode
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>System Passcode Management</DialogTitle>
          <DialogDescription>
            Control access to the system by managing the signup passcode
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Current Passcode</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <div className="flex-1 relative">
                  <Input
                    type={showPasscode ? "text" : "password"}
                    value={currentPasscode}
                    readOnly
                    className="pr-20"
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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Update Passcode</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePasscode} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="new-passcode">New Passcode</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="new-passcode"
                      type="text"
                      placeholder="Enter new passcode"
                      value={newPasscode}
                      onChange={(e) => setNewPasscode(e.target.value)}
                      className="flex-1"
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
                    Share this passcode with authorized users for account creation
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Updating..." : "Update Passcode"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PasscodeManager;
