
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
    isActive ? "bg-muted font-bold text-[#3C83F6]" : "hover:bg-muted/50 font-bold text-[#3C83F6]";

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
      <div className="p-4 border-b bg-sidebar">
        <div className="flex items-center gap-2">
          <VoiceQCLogo size="md" />
          {!collapsed}
        </div>
      </div>

      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[#3C83F6] font-bold">Main Navigation</SidebarGroupLabel>
          
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
                <SidebarMenuButton asChild>
                  <button onClick={toggleTheme} className={getNavCls({ isActive: false })}>
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
                <SidebarMenuButton asChild>
                  <button onClick={handleSignOut} className={getNavCls({ isActive: false })}>
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
