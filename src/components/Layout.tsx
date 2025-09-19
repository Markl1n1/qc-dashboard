
import React from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarProvider } from './ui/sidebar';
import { AppSidebar } from './AppSidebar';
import BackgroundAnalysisManager from './BackgroundAnalysisManager';

const Layout: React.FC = () => {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
      <BackgroundAnalysisManager />
    </SidebarProvider>
  );
};

export default Layout;
