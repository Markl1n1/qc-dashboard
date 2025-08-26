
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Home, 
  Upload, 
  Settings, 
  LogOut, 
  Users, 
  BarChart3, 
  FileText,
  User
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from './ui/sidebar';
import { useAuthStore } from '../store/authStore';
import VoiceQCLogo from './VoiceQCLogo';

const navigationItems = [
  { title: 'Dashboard', url: '/unified-dashboard', icon: Home },
  { title: 'Upload', url: '/upload', icon: Upload },
  { title: 'Agent Management', url: '/agents', icon: Users },
  { title: 'Settings', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { signOut } = useAuthStore();
  
  const currentPath = location.pathname;
  const collapsed = state === 'collapsed';
  
  const isActive = (path: string) => currentPath === path;
  const isExpanded = navigationItems.some((i) => isActive(i.url));
  
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-muted text-primary font-medium" : "hover:bg-muted/50";

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <Sidebar
      className={collapsed ? "w-14" : "w-60"}
      collapsible="icon"
    >
      {/* Header with logo and trigger */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <VoiceQCLogo size={collapsed ? 24 : 32} />
          {!collapsed && <span className="font-bold text-lg">VoiceQC</span>}
        </div>
        <SidebarTrigger className="mt-2" />
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Navigation</SidebarGroupLabel>
          
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              
              {/* Sign out button */}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {!collapsed && <span>Sign Out</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
