
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Upload, Settings, LogOut, Users, BarChart3, FileText, User, Sun, Moon } from 'lucide-react';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger, useSidebar } from './ui/sidebar';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../hooks/useTheme';
import VoiceQCLogo from './VoiceQCLogo';

const navigationItems = [{
  title: 'Dashboard',
  url: '/unified-dashboard',
  icon: Home
}, {
  title: 'Upload',
  url: '/upload',
  icon: Upload
}, {
  title: 'Agent Management',
  url: '/agents',
  icon: Users
}, {
  title: 'Settings',
  url: '/settings',
  icon: Settings
}];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { logout } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const currentPath = location.pathname;
  const collapsed = state === 'collapsed';
  const isActive = (path: string) => currentPath === path;

  const getNavCls = ({ isActive }: { isActive: boolean }) => 
    isActive ? "bg-muted text-primary font-medium" : "hover:bg-muted/50";

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <Sidebar className={collapsed ? "w-14" : "w-60"} collapsible="icon">
      {/* Header with logo and trigger */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <VoiceQCLogo size="md" />
          {!collapsed}
        </div>
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Navigation</SidebarGroupLabel>
          
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              
              {/* Theme toggle button with consistent styling */}
              <SidebarMenuItem>
                <SidebarMenuButton className="hover:bg-muted/50">
                  <button onClick={toggleTheme} className="flex items-center w-full">
                    {theme === 'light' ? (
                      <Moon className="mr-2 h-4 w-4" />
                    ) : (
                      <Sun className="mr-2 h-4 w-4" />
                    )}
                    {!collapsed && <span>Theme</span>}
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {/* Sign out button with consistent styling */}
              <SidebarMenuItem>
                <SidebarMenuButton className="hover:bg-muted/50">
                  <button onClick={handleSignOut} className="flex items-center w-full">
                    <LogOut className="mr-2 h-4 w-4" />
                    {!collapsed && <span>Sign Out</span>}
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
