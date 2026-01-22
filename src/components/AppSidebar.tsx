
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Upload, Settings, LogOut, Users, BarChart3, FileText, User, Sun, Moon, Lock, Shield } from 'lucide-react';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger, useSidebar } from './ui/sidebar';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../hooks/useTheme';
import { useUserRole } from '../hooks/useUserRole';
import { useUserProfile } from '../hooks/useUserProfile';
import { Button } from './ui/button';
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
  title: 'Admin Dashboard',
  url: '/admin',
  icon: Shield,
  adminOnly: true
}, {
  title: 'Settings',
  url: '/settings',
  icon: Settings,
  adminOnly: true
}, {
  title: 'Change Password',
  url: '/change-password',
  icon: Lock
}];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { logout } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const { isAdmin } = useUserRole();
  const { profile, isLoading: profileLoading } = useUserProfile();
  // Always show extended mode - removed hamburger toggle
  const currentPath = location.pathname;
  const collapsed = state === 'collapsed';
  const isActive = (path: string) => currentPath === path;

  const getNavCls = ({ isActive }: { isActive: boolean }) => 
    isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/50 font-medium text-sidebar-foreground";

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
      {/* Header with logo */}
      <div className="p-4 border-b bg-sidebar">
        <div className="flex items-center gap-2">
          <VoiceQCLogo size="md" />
        </div>
      </div>

      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground font-medium">
            {!collapsed ? (
              profileLoading ? 'Loading...' : (profile?.name || 'Main Navigation')
            ) : ''}
          </SidebarGroupLabel>
          
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems
                .filter(item => !item.adminOnly || isAdmin)
                .map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className={`${collapsed ? 'h-6 w-6' : 'mr-2 h-4 w-4'}`} />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              
              {/* Theme toggle button with consistent styling */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button onClick={toggleTheme} className={getNavCls({ isActive: false })}>
                    {theme === 'light' ? (
                      <Moon className={`${collapsed ? 'h-6 w-6' : 'mr-2 h-4 w-4'}`} />
                    ) : (
                      <Sun className={`${collapsed ? 'h-6 w-6' : 'mr-2 h-4 w-4'}`} />
                    )}
                    {!collapsed && <span>Theme</span>}
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {/* Sign out button with consistent styling */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button onClick={handleSignOut} className={getNavCls({ isActive: false })}>
                    <LogOut className={`${collapsed ? 'h-6 w-6' : 'mr-2 h-4 w-4'}`} />
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
