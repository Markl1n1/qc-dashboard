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

// Cache users for 2 minutes to reduce database calls
let userCache: UserCache | null = null;
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

const OptimizedAdminManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPasswordResetDialog, setShowPasswordResetDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    name: '',
    role: 'supervisor' as 'admin' | 'supervisor'
  });
  const [pendingOperations, setPendingOperations] = useState<Set<string>>(new Set());

  // Memoized filtered users to prevent unnecessary re-renders
  const memoizedFilteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    
    const term = searchTerm.toLowerCase();
    return users.filter(user => 
      user.name.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term) ||
      user.role.toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  useEffect(() => {
    setFilteredUsers(memoizedFilteredUsers);
  }, [memoizedFilteredUsers]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = useCallback(async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      
      // Check cache first unless force refresh
      if (!forceRefresh && userCache && (Date.now() - userCache.timestamp) < CACHE_DURATION) {
        setUsers(userCache.users);
        setIsLoading(false);
        return;
      }

      // Optimized query - select only required columns and add index hint
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const processedUsers = (data || []).map(user => ({
        ...user,
        role: user.role as 'admin' | 'supervisor'
      }));
      
      // Update cache
      userCache = {
        users: processedUsers,
        timestamp: Date.now()
      };
      
      setUsers(processedUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createUser = useCallback(async () => {
    if (!newUser.email || !newUser.password || !newUser.name) {
      toast.error('Please fill in all fields');
      return;
    }

    const operationId = 'create-user';
    setPendingOperations(prev => new Set(prev).add(operationId));

    try {
      // Optimistic update - add user to UI immediately
      const tempId = `temp-${Date.now()}`;
      const tempUser: User = {
        id: tempId,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        created_at: new Date().toISOString()
      };
      
      setUsers(prev => [tempUser, ...prev]);
      toast.success('Creating user...', { duration: 1000 });

      // Create user via Supabase Auth Admin API
      const { data, error } = await supabase.auth.admin.createUser({
        email: newUser.email,
        password: newUser.password,
        email_confirm: true,
        user_metadata: {
          name: newUser.name
        }
      });

      if (error) throw error;

      // Update the profile with the correct role
      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ 
            role: newUser.role,
            name: newUser.name 
          })
          .eq('id', data.user.id);

        if (profileError) {
          console.error('Error updating profile:', profileError);
          toast.error('User created but role assignment failed');
        } else {
          // Replace temp user with real user
          setUsers(prev => prev.map(user => 
            user.id === tempId 
              ? { ...user, id: data.user.id }
              : user
          ));
          toast.success(`${newUser.role === 'admin' ? 'Admin' : 'Supervisor'} user created successfully`);
        }
      }

      setShowCreateDialog(false);
      setNewUser({ email: '', password: '', name: '', role: 'supervisor' });
      
      // Clear cache to force refresh
      userCache = null;
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(`Failed to create user: ${error.message}`);
      
      // Remove temp user on error
      setUsers(prev => prev.filter(user => !user.id.startsWith('temp-')));
      
      // Refresh users from server
      await loadUsers(true);
    } finally {
      setPendingOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(operationId);
        return newSet;
      });
    }
  }, [newUser, loadUsers]);

  const resetPassword = useCallback(async (userId: string, newPassword: string) => {
    const operationId = `reset-${userId}`;
    setPendingOperations(prev => new Set(prev).add(operationId));

    try {
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        password: newPassword
      });

      if (error) throw error;

      toast.success('Password reset successfully. User will be prompted to change it on next login.');
      setShowPasswordResetDialog(false);
      setSelectedUser(null);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error(`Failed to reset password: ${error.message}`);
    } finally {
      setPendingOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(operationId);
        return newSet;
      });
    }
  }, []);

  const updateUserRole = useCallback(async (userId: string, newRole: 'admin' | 'supervisor') => {
    const operationId = `role-${userId}`;
    setPendingOperations(prev => new Set(prev).add(operationId));

    // Optimistic update
    setUsers(prev => prev.map(user => 
      user.id === userId ? { ...user, role: newRole } : user
    ));

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      toast.success(`User role updated to ${newRole}`);
      
      // Clear cache
      userCache = null;
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error(`Failed to update role: ${error.message}`);
      
      // Revert optimistic update
      await loadUsers(true);
    } finally {
      setPendingOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(operationId);
        return newSet;
      });
    }
  }, [loadUsers]);

  const deleteUser = useCallback(async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    const operationId = `delete-${userId}`;
    setPendingOperations(prev => new Set(prev).add(operationId));

    // Optimistic update - remove from UI immediately
    const userToDelete = users.find(u => u.id === userId);
    setUsers(prev => prev.filter(user => user.id !== userId));
    toast.success('Deleting user...', { duration: 1000 });

    try {
      const { error } = await supabase.auth.admin.deleteUser(userId);

      if (error) throw error;

      toast.success('User deleted successfully');
      
      // Clear cache
      userCache = null;
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(`Failed to delete user: ${error.message}`);
      
      // Restore user on error
      if (userToDelete) {
        setUsers(prev => [userToDelete, ...prev].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
      }
    } finally {
      setPendingOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(operationId);
        return newSet;
      });
    }
  }, [users]);

  // Debounced search handler
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-muted-foreground">Manage admin and supervisor users</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button disabled={pendingOperations.has('create-user')}>
              <UserPlus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Create a new admin or supervisor user account
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input
                  id="name"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="col-span-3"
                  placeholder="Full name"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="col-span-3"
                  placeholder="user@example.com"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="password" className="text-right">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="col-span-3"
                  placeholder="Temporary password"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="role" className="text-right">Role</Label>
                <Select 
                  value={newUser.role} 
                  onValueChange={(value: 'admin' | 'supervisor') => setNewUser({ ...newUser, role: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={createUser}
                disabled={pendingOperations.has('create-user')}
              >
                {pendingOperations.has('create-user') ? 'Creating...' : 'Create User'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Manage system users and their roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search bar */}
          <div className="flex items-center space-x-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-4">Loading users...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
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
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setShowPasswordResetDialog(true);
                          }}
                          disabled={pendingOperations.has(`reset-${user.id}`)}
                        >
                          <Key className="h-3 w-3 mr-1" />
                          {pendingOperations.has(`reset-${user.id}`) ? 'Resetting...' : 'Reset Password'}
                        </Button>
                        <Select
                          value={user.role}
                          onValueChange={(value: 'admin' | 'supervisor') => updateUserRole(user.id, value)}
                          disabled={pendingOperations.has(`role-${user.id}`)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="supervisor">Supervisor</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteUser(user.id)}
                          disabled={pendingOperations.has(`delete-${user.id}`)}
                        >
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

      {/* Password Reset Dialog */}
      <Dialog open={showPasswordResetDialog} onOpenChange={setShowPasswordResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Reset password for {selectedUser?.name} ({selectedUser?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              This will set a temporary password for the user. They will be prompted to change it on their next login.
            </p>
            <Input
              type="password"
              placeholder="New temporary password"
              className="mt-4"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const input = e.target as HTMLInputElement;
                  if (selectedUser && input.value) {
                    resetPassword(selectedUser.id, input.value);
                  }
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordResetDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                const input = document.querySelector('input[type="password"]') as HTMLInputElement;
                if (selectedUser && input?.value) {
                  resetPassword(selectedUser.id, input.value);
                }
              }}
              disabled={selectedUser ? pendingOperations.has(`reset-${selectedUser.id}`) : false}
            >
              {selectedUser && pendingOperations.has(`reset-${selectedUser.id}`) ? 'Resetting...' : 'Reset Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OptimizedAdminManagement;