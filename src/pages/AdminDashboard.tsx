import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Shield, Users, Key, Settings } from 'lucide-react';
import OptimizedAdminManagement from '../components/OptimizedAdminManagement';
import DataRetentionManager from '../components/DataRetentionManager';
import PasscodeManager from '../components/PasscodeManager';
import PerformanceMonitor from '../components/PerformanceMonitor';
import { useUserRole } from '../hooks/useUserRole';
import { Navigate } from 'react-router-dom';

const AdminDashboard = () => {
  const { isAdmin, isLoading } = useUserRole();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/unified-dashboard" replace />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8 text-primary" />
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage users, system settings, and security configurations
        </p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            User Management
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            System Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <OptimizedAdminManagement />
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Registration Passcode</CardTitle>
                <CardDescription>
                  Manage the passcode required for new user registration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PasscodeManager />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Password Management</CardTitle>
                <CardDescription>
                  Information about password storage and reset procedures
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Password Storage</h4>
                    <p className="text-sm text-muted-foreground">
                      Passwords are securely hashed and stored by Supabase Auth. The system never stores plaintext passwords.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Password Reset Process</h4>
                    <p className="text-sm text-muted-foreground">
                      1. Admin creates a temporary password for the user<br/>
                      2. User logs in with the temporary password<br/>
                      3. System prompts user to set a new permanent password<br/>
                      4. Temporary password is invalidated after successful reset
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <div className="space-y-6">
            <PerformanceMonitor />
            <DataRetentionManager />
            
            <Card>
              <CardHeader>
                <CardTitle>System Configuration</CardTitle>
                <CardDescription>
                  Global system settings and configurations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Additional system settings will be available here in future updates.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;