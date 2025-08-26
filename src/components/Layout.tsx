
import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from './ui/sidebar';
import { AppSidebar } from './AppSidebar';

export default function Layout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
