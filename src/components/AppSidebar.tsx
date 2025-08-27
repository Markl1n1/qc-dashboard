
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from './ui/sidebar';
import { useAuthStore } from '../store/authStore';
import { LayoutDashboard, LogOut, Moon, Settings, Sun, Upload, Users } from 'lucide-react';

const AppSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getNavCls = (isActive: boolean) => {
    return cn(
      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold transition-all hover:text-primary",
      isActive 
        ? "bg-muted text-primary" 
        : "text-muted-foreground hover:text-primary"
    );
  };

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <LayoutDashboard className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">VoiceQC</span>
                  <span className="truncate text-xs">Quality Control</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Navigation</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/unified-dashboard" className={getNavCls(location.pathname === '/unified-dashboard')}>
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/upload" className={getNavCls(location.pathname === '/upload')}>
                  <Upload className="h-4 w-4" />
                  Upload
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/agent-management" className={getNavCls(location.pathname === '/agent-management')}>
                  <Users className="h-4 w-4" />
                  Agent Management
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/settings" className={getNavCls(location.pathname === '/settings')}>
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <button className={getNavCls(false)}>
                  <Moon className="h-4 w-4" />
                  Theme
                </button>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <button
                  onClick={handleLogout}
                  className={getNavCls(false)}
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <p className="px-3 text-center text-xs text-muted-foreground">
          <a
            href="https://github.com/steven-tey/precedent"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            precedent
          </a>
          <br />
          <span>
            Built by
            <a href="https://twitter.com/steventey" target="_blank" rel="noreferrer" className="ml-1 underline underline-offset-2">
              @steventey
            </a>
          </span>
        </p>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
