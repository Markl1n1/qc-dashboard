
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from './ui/sonner';
import UserProfileMenu from './UserProfileMenu';
import VoiceQCLogo from './VoiceQCLogo';

const Layout: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <VoiceQCLogo size="md" />
            <h1 className="hidden sm:block text-xl font-semibold">VoiceQC</h1>
          </div>
          <UserProfileMenu />
        </div>
      </header>
      
      <main className="flex-1">
        <div className="w-full max-w-full overflow-x-hidden">
          <Outlet />
        </div>
      </main>
      
      <Toaster 
        position="top-right"
        expand={false}
        richColors
        closeButton
      />
    </div>
  );
};

export default Layout;
