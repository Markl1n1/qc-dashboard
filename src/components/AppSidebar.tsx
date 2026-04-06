
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Upload, Settings, LogOut, Users, BarChart3, FileText, User, Sun, Moon, Lock, Shield, Languages } from 'lucide-react';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger, useSidebar } from './ui/sidebar';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../hooks/useTheme';
import { useUserRole } from '../hooks/useUserRole';
import { useUserProfile } from '../hooks/useUserProfile';
import { Button } from './ui/button';
import VoiceQCLogo from './VoiceQCLogo';
import { useTranslation } from '../i18n';
import { useLanguageStore } from '../store/languageStore';

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { logout } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const { isAdmin } = useUserRole();
  const { profile, isLoading: profileLoading } = useUserProfile();
  const { t } = useTranslation();
  const { toggleUiLanguage, uiLanguage } = useLanguageStore();
  const currentPath = location.pathname;
  const collapsed = state === 'collapsed';
  const isActive = (path: string) => currentPath === path;

  const navigationItems = [{
    title: t('nav.dashboard'),
    url: '/unified-dashboard',
    icon: Home
  }, {
    title: t('nav.upload'),
    url: '/upload',
    icon: Upload
  }, {
    title: t('nav.agents'),
    url: '/agents',
    icon: Users
  }, {
    title: t('nav.admin'),
    url: '/admin',
    icon: Shield,
    adminOnly: true
  }, {
    title: t('nav.settings'),
    url: '/settings',
    icon: Settings,
    adminOnly: true
  }, {
    title: t('nav.changePassword'),
    url: '/change-password',
    icon: Lock
  }];

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
      {/* Header with logo and language toggle */}
      <div className="p-4 border-b bg-sidebar">
        <div className="flex items-center gap-2">
          <VoiceQCLogo size="md" />
          {!collapsed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleUiLanguage}
              className="ml-auto h-8 w-8 p-0 shrink-0"
              title={uiLanguage === 'en' ? 'Переключить на русский' : 'Switch to English'}
            >
              <Languages className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground font-medium">
            {!collapsed ? (
              profileLoading ? t('common.loading') : (profile?.name || t('nav.dashboard'))
            ) : ''}
          </SidebarGroupLabel>
          
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems
                .filter(item => !item.adminOnly || isAdmin)
                .map(item => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className={`${collapsed ? 'h-6 w-6' : 'mr-2 h-4 w-4'}`} />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              
              {/* Language toggle in collapsed mode */}
              {collapsed && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <button onClick={toggleUiLanguage} className={getNavCls({ isActive: false })}>
                      <Languages className="h-6 w-6" />
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              
              {/* Theme toggle button */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button onClick={toggleTheme} className={getNavCls({ isActive: false })}>
                    {theme === 'light' ? (
                      <Moon className={`${collapsed ? 'h-6 w-6' : 'mr-2 h-4 w-4'}`} />
                    ) : (
                      <Sun className={`${collapsed ? 'h-6 w-6' : 'mr-2 h-4 w-4'}`} />
                    )}
                    {!collapsed && <span>{t('nav.theme')}</span>}
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {/* Sign out button */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button onClick={handleSignOut} className={getNavCls({ isActive: false })}>
                    <LogOut className={`${collapsed ? 'h-6 w-6' : 'mr-2 h-4 w-4'}`} />
                    {!collapsed && <span>{t('nav.signOut')}</span>}
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
