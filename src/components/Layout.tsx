
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { Upload, Home, Settings } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useUserRole } from '../hooks/useUserRole';
import UserProfileMenu from './UserProfileMenu';
import PasscodeManager from './PasscodeManager';
import VoiceQCLogo from './VoiceQCLogo';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const { isAdmin } = useUserRole();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <Link to="/" className="flex items-center">
                <VoiceQCLogo />
              </Link>
              
              {isAuthenticated && (
                <nav className="flex items-center space-x-4">
                  <Button
                    variant={isActive('/') ? 'default' : 'ghost'}
                    size="sm"
                    asChild
                  >
                    <Link to="/">
                      <Home className="mr-2 h-4 w-4" />
                      Dashboard
                    </Link>
                  </Button>
                  <Button
                    variant={isActive('/upload') ? 'default' : 'ghost'}
                    size="sm"
                    asChild
                  >
                    <Link to="/upload">
                      <Upload className="mr-2 h-4 w-4" />
                      Upload
                    </Link>
                  </Button>
                  {isAdmin && (
                    <Button
                      variant={isActive('/settings') ? 'default' : 'ghost'}
                      size="sm"
                      asChild
                    >
                      <Link to="/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </Button>
                  )}
                </nav>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  {isAdmin && <PasscodeManager />}
                  <UserProfileMenu />
                </>
              ) : (
                <Button asChild>
                  <Link to="/auth">Login</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
};

export default Layout;
