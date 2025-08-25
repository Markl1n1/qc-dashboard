
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { Upload, Home, Settings, Menu } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useUserRole } from '../hooks/useUserRole';
import UserProfileMenu from './UserProfileMenu';
import VoiceQCLogo from './VoiceQCLogo';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from './ui/sheet';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const { isAdmin } = useUserRole();

  const isActive = (path: string) => location.pathname === path;

  const NavigationItems = () => (
    <>
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
    </>
  );

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
                <>
                  {/* Desktop Navigation */}
                  <nav className="hidden md:flex items-center space-x-4">
                    <NavigationItems />
                  </nav>
                  
                  {/* Mobile Navigation */}
                  <div className="md:hidden">
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Menu className="h-5 w-5" />
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="left" className="w-64">
                        <div className="flex flex-col space-y-4 mt-8">
                          <NavigationItems />
                        </div>
                      </SheetContent>
                    </Sheet>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <UserProfileMenu />
              ) : (
                <Button asChild size="sm">
                  <Link to="/auth">Login</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="min-h-[calc(100vh-4rem)]">{children}</main>
    </div>
  );
};

export default Layout;
