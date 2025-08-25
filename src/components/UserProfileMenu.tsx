
import React, { useState } from 'react';
import { User, Settings, LogOut, Shield } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback } from './ui/avatar';
import { useAuthStore } from '../store/authStore';
import { useUserRole } from '../hooks/useUserRole';
import { useNavigate } from 'react-router-dom';
import PasscodeManager from './PasscodeManager';

const UserProfileMenu = () => {
  const { user, signOut } = useAuthStore();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const [showPasscodeManager, setShowPasscodeManager] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleSettings = () => {
    navigate('/settings');
  };

  const getInitials = (email: string) => {
    return email?.split('@')[0]?.substring(0, 2)?.toUpperCase() || 'U';
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {getInitials(user?.email || '')}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <div className="flex items-center justify-start gap-2 p-2">
            <div className="flex flex-col space-y-1 leading-none">
              {user?.email && (
                <p className="text-sm font-medium leading-none">{user.email}</p>
              )}
              {isAdmin && (
                <p className="text-xs leading-none text-muted-foreground">
                  Administrator
                </p>
              )}
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSettings}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
          {isAdmin && (
            <DropdownMenuItem onClick={() => setShowPasscodeManager(true)}>
              <Shield className="mr-2 h-4 w-4" />
              <span>Manage Passcode</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showPasscodeManager && (
        <PasscodeManager 
          open={showPasscodeManager}
          onClose={() => setShowPasscodeManager(false)}
        />
      )}
    </>
  );
};

export default UserProfileMenu;
