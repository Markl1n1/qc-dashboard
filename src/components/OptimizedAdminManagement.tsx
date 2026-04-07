import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { supabase } from '../integrations/supabase/client';
import { UserPlus, Shield, Key, Trash2, Search } from 'lucide-react';
import { useTranslation } from '../i18n';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'supervisor';
  created_at: string;
}

interface UserCache {
  users: User[];
  timestamp: number;
}

let userCache: UserCache | null = null;
const CACHE_DURATION = 2 * 60 * 1000;

const OptimizedAdminManagement = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPasswordResetDialog, setShowPasswordResetDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'supervisor' as 'admin' | 'supervisor' });
  const [pendingOperations, setPendingOperations] = useState<Set<string>>(new Set());

  const memoizedFilteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    const term = searchTerm.toLowerCase();
    return users.filter(user => user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term) || user.role.toLowerCase().includes(term));
  }, [users, searchTerm]);

  useEffect(() => { setFilteredUsers(memoizedFilteredUsers); }, [memoizedFilteredUsers]);
  useEffect(() => { loadUsers(); }, []);

  const loadUsers = useCallback(async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      if (!forceRefresh && userCache && (Date.now() - userCache.timestamp) < CACHE_DURATION) {
        setUsers(userCache.users); setIsLoading(false); return;
      }
      const { data, error } = await supabase.functions.invoke('admin-operations', { body: { operation: 'list_users' } });
      if (error) throw error;
      const processedUsers = (data?.users || []).map((user: any) => ({ ...user, role: user.role as 'admin' | 'supervisor' }));
      userCache = { users: processedUsers, timestamp: Date.now() };
      setUsers(processedUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error(t('admin.loadFailed'));
    } finally { setIsLoading(false); }
  }, [t]);

  const createUser = useCallback(async () => {
    if (!newUser.email || !newUser.password || !newUser.name) { toast.error(t('admin.fillAllFields')); return; }
    const operationId = 'create-user';
    setPendingOperations(prev => new Set(prev).add(operationId));
    try {
      const tempId = `temp-${Date.now()}`;
      setUsers(prev => [{ id: tempId, name: newUser.name, email: newUser.email, role: newUser.role, created_at: new Date().toISOString() }, ...prev]);
      toast.success(t('admin.creatingUser'), { duration: 1000 });
      const { data, error } = await supabase.functions.invoke('admin-operations', {
        body: { operation: 'create_user', data: { email: newUser.email, password: newUser.password, name: newUser.name, role: newUser.role } }
      });
      if (error) throw error;
      if (data?.user) {
        const msg = data.user_already_existed
          ? `${newUser.role === 'admin' ? 'Admin' : 'Supervisor'} ${t('admin.userAlreadyExisted')}`
          : `${newUser.role === 'admin' ? 'Admin' : 'Supervisor'} ${t('admin.userCreated')}`;
        toast.success(msg);
      }
      setShowCreateDialog(false);
      setNewUser({ email: '', password: '', name: '', role: 'supervisor' });
      await loadUsers(true);
    } catch (error: any) {
      let errorMessage = t('admin.createFailed');
      if (error.message?.includes('already exists') || error.status === 409) errorMessage = t('admin.userEmailExists');
      else if (error.message) errorMessage = `${t('admin.createFailed')}: ${error.message}`;
      toast.error(errorMessage);
      setUsers(prev => prev.filter(user => !user.id.startsWith('temp-')));
      await loadUsers(true);
    } finally {
      setPendingOperations(prev => { const s = new Set(prev); s.delete(operationId); return s; });
    }
  }, [newUser, loadUsers, t]);

  const resetPassword = useCallback(async (userId: string, newPassword: string) => {
    const operationId = `reset-${userId}`;
    setPendingOperations(prev => new Set(prev).add(operationId));
    try {
      const { error } = await supabase.functions.invoke('admin-operations', { body: { operation: 'reset_password', data: { userId, newPassword } } });
      if (error) throw error;
      toast.success(t('admin.passwordReset'));
      setShowPasswordResetDialog(false); setSelectedUser(null);
    } catch (error: any) {
      toast.error(`${t('admin.passwordResetFailed')}: ${error.message}`);
    } finally {
      setPendingOperations(prev => { const s = new Set(prev); s.delete(operationId); return s; });
    }
  }, [t]);

  const updateUserRole = useCallback(async (userId: string, newRole: 'admin' | 'supervisor') => {
    const operationId = `role-${userId}`;
    setPendingOperations(prev => new Set(prev).add(operationId));
    setUsers(prev => prev.map(user => user.id === userId ? { ...user, role: newRole } : user));
    try {
      const { error } = await supabase.functions.invoke('admin-operations', { body: { operation: 'batch_user_update', data: { updates: [{ userId, role: newRole }] } } });
      if (error) throw error;
      toast.success(`${t('admin.roleUpdated')} ${newRole}`);
      userCache = null;
    } catch (error: any) {
      toast.error(`${t('admin.roleUpdateFailed')}: ${error.message}`);
      await loadUsers(true);
    } finally {
      setPendingOperations(prev => { const s = new Set(prev); s.delete(operationId); return s; });
    }
  }, [loadUsers, t]);

  const deleteUser = useCallback(async (userId: string) => {
    if (!confirm(t('admin.confirmDelete'))) return;
    const operationId = `delete-${userId}`;
    setPendingOperations(prev => new Set(prev).add(operationId));
    const userToDelete = users.find(u => u.id === userId);
    setUsers(prev => prev.filter(user => user.id !== userId));
    toast.success(t('admin.deletingUser'), { duration: 1000 });
    try {
      const { error } = await supabase.functions.invoke('admin-operations', { body: { operation: 'delete_user', data: { userId } } });
      if (error) throw error;
      toast.success(t('admin.userDeleted'));
      userCache = null;
    } catch (error: any) {
      toast.error(`${t('admin.deleteFailed')}: ${error.message}`);
      if (userToDelete) setUsers(prev => [userToDelete, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } finally {
      setPendingOperations(prev => { const s = new Set(prev); s.delete(operationId); return s; });
    }
  }, [users, t]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{t('admin.userManagement')}</h2>
          <p className="text-muted-foreground">{t('admin.manageAdminSupervisor')}</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button disabled={pendingOperations.has('create-user')}>
              <UserPlus className="h-4 w-4 mr-2" />
              {t('admin.createUser')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('admin.createNewUser')}</DialogTitle>
              <DialogDescription>{t('admin.createNewUserDesc')}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">{t('admin.name')}</Label>
                <Input id="name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} className="col-span-3" placeholder={t('admin.fullName')} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">{t('admin.email')}</Label>
                <Input id="email" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="col-span-3" placeholder="user@example.com" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="password" className="text-right">{t('auth.password')}</Label>
                <Input id="password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="col-span-3" placeholder={t('admin.temporaryPassword')} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="role" className="text-right">{t('admin.role')}</Label>
                <Select value={newUser.role} onValueChange={(value: 'admin' | 'supervisor') => setNewUser({ ...newUser, role: value })}>
                  <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>{t('common.cancel')}</Button>
              <Button onClick={createUser} disabled={pendingOperations.has('create-user')}>
                {pendingOperations.has('create-user') ? t('admin.creating') : t('admin.createUser')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.users')}</CardTitle>
          <CardDescription>{t('admin.manageUsers')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder={t('admin.searchUsers')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm" />
          </div>

          {isLoading ? (
            <div className="text-center py-4">{t('admin.loadingUsers')}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.name')}</TableHead>
                  <TableHead>{t('admin.email')}</TableHead>
                  <TableHead>{t('admin.role')}</TableHead>
                  <TableHead>{t('admin.created')}</TableHead>
                  <TableHead>{t('admin.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setSelectedUser(user); setShowPasswordResetDialog(true); }} disabled={pendingOperations.has(`reset-${user.id}`)}>
                          <Key className="h-3 w-3 mr-1" />
                          {pendingOperations.has(`reset-${user.id}`) ? t('admin.resetting') : t('admin.resetPassword')}
                        </Button>
                        <Select value={user.role} onValueChange={(value: 'admin' | 'supervisor') => updateUserRole(user.id, value)} disabled={pendingOperations.has(`role-${user.id}`)}>
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="supervisor">Supervisor</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="destructive" size="sm" onClick={() => deleteUser(user.id)} disabled={pendingOperations.has(`delete-${user.id}`) || user.role === 'admin'} title={user.role === 'admin' ? t('admin.adminCantDelete') : t('admin.deleteUser')}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showPasswordResetDialog} onOpenChange={setShowPasswordResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.resetPassword')}</DialogTitle>
            <DialogDescription>{t('admin.resetPasswordFor')} {selectedUser?.name} ({selectedUser?.email})</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">{t('admin.tempPasswordHint')}</p>
            <Input type="password" placeholder={t('admin.newTempPassword')} className="mt-4" onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const input = e.target as HTMLInputElement;
                if (selectedUser && input.value) resetPassword(selectedUser.id, input.value);
              }
            }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordResetDialog(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => {
              const input = document.querySelector('input[type="password"]') as HTMLInputElement;
              if (selectedUser && input?.value) resetPassword(selectedUser.id, input.value);
            }} disabled={selectedUser ? pendingOperations.has(`reset-${selectedUser.id}`) : false}>
              {selectedUser && pendingOperations.has(`reset-${selectedUser.id}`) ? t('admin.resetting') : t('admin.resetPassword')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OptimizedAdminManagement;
