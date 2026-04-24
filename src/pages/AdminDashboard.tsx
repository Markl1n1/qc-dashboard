import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Shield, Users, Key, Settings } from 'lucide-react';
import OptimizedAdminManagement from '../components/OptimizedAdminManagement';
import DataRetentionManager from '../components/DataRetentionManager';
import PasscodeManager from '../components/PasscodeManager';
import PerformanceMonitor from '../components/PerformanceMonitor';
import PipelineHealthCard from '../components/PipelineHealthCard';
import { useUserRole } from '../hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { useTranslation } from '../i18n';

const AdminDashboard = () => {
  const { isAdmin, isLoading } = useUserRole();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center">
          <div className="text-center">{t('common.loading')}</div>
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
          {t('admin.title')}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t('admin.description')}
        </p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t('admin.userManagement')}
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            {t('admin.security')}
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {t('admin.systemSettings')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6 space-y-6">
          <PipelineHealthCard />
          <OptimizedAdminManagement />
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('admin.registrationPasscode')}</CardTitle>
                <CardDescription>
                  {t('admin.registrationPasscodeDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PasscodeManager />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <div className="space-y-6">
            <PerformanceMonitor />
            <DataRetentionManager />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;